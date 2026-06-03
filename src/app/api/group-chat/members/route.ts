import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/mail';

// GET /api/group-chat/members?groupId=X - Get all members of a group
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    if (!groupId) {
      return NextResponse.json({ success: false, error: 'Missing groupId parameter.' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Check if requesting user is a member of this group
    const memberCheck = await pool.request()
      .input('groupId', sql.Int, parseInt(groupId))
      .input('username', sql.VarChar, session.username)
      .query('SELECT 1 FROM ChatGroupMembers WHERE GroupId = @groupId AND Username = @username');

    if (memberCheck.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'You are not a member of this group.' }, { status: 403 });
    }

    // Get all members
    const res = await pool.request()
      .input('groupId', sql.Int, parseInt(groupId))
      .query(`
        SELECT m.Username as username, m.JoinedDate as joinedDate, g.CreatedBy as groupCreator
        FROM ChatGroupMembers m
        INNER JOIN ChatGroups g ON g.Id = m.GroupId
        WHERE m.GroupId = @groupId
        ORDER BY m.JoinedDate ASC
      `);

    const members = res.recordset.map(row => ({
      username: row.username,
      joinedDate: row.joinedDate instanceof Date ? row.joinedDate.toISOString() : new Date(row.joinedDate).toISOString(),
      isCreator: row.username === row.groupCreator
    }));

    return NextResponse.json({ success: true, members });
  } catch (error: any) {
    console.error('API GET group-chat/members error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/group-chat/members - Add a member to a group (by direct add or invite link join)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const body = await request.json();
    const { groupId, username } = body;

    if (!groupId) {
      return NextResponse.json({ success: false, error: 'Missing required field: groupId' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Check group exists
    const groupCheck = await pool.request()
      .input('groupId', sql.Int, groupId)
      .query('SELECT Id, CreatedBy FROM ChatGroups WHERE Id = @groupId');

    if (groupCheck.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'Group does not exist.' }, { status: 404 });
    }

    // Determine the target username (self-join via invite or adding another user)
    const targetUsername = username || session.username;

    // If adding another user (not self), verify the requester is a member of the group
    if (targetUsername !== session.username) {
      const requesterCheck = await pool.request()
        .input('groupId', sql.Int, groupId)
        .input('username', sql.VarChar, session.username)
        .query('SELECT 1 FROM ChatGroupMembers WHERE GroupId = @groupId AND Username = @username');

      if (requesterCheck.recordset.length === 0) {
        return NextResponse.json({ success: false, error: 'You are not a member of this group and cannot add others.' }, { status: 403 });
      }
    }

    // Verify target user exists in the system
    const userCheck = await pool.request()
      .input('username', sql.VarChar, targetUsername)
      .query('SELECT 1 FROM Users WHERE Username = @username');

    if (userCheck.recordset.length === 0) {
      return NextResponse.json({ success: false, error: `User "${targetUsername}" does not exist.` }, { status: 404 });
    }

    // Check if already a member
    const alreadyMember = await pool.request()
      .input('groupId', sql.Int, groupId)
      .input('username', sql.VarChar, targetUsername)
      .query('SELECT 1 FROM ChatGroupMembers WHERE GroupId = @groupId AND Username = @username');

    if (alreadyMember.recordset.length > 0) {
      return NextResponse.json({ success: true, message: 'Already a member of this group.', alreadyMember: true });
    }

    // Insert member
    await pool.request()
      .input('groupId', sql.Int, groupId)
      .input('username', sql.VarChar, targetUsername)
      .query('INSERT INTO ChatGroupMembers (GroupId, Username) VALUES (@groupId, @username)');

    // Notify the newly added member via email
    try {
      const emailRes = await pool.request()
        .input('username', sql.VarChar, targetUsername)
        .query('SELECT Email FROM Users WHERE Username = @username');

      const userEmail = emailRes.recordset[0]?.Email;
      const groupName = groupCheck.recordset[0] ? 
        (await pool.request().input('groupId', sql.Int, groupId).query('SELECT Name FROM ChatGroups WHERE Id = @groupId')).recordset[0]?.Name 
        : `Group #${groupId}`;

      const isSelfJoin = targetUsername === session.username;

      if (userEmail) {
        await sendEmail({
          to: userEmail,
          subject: isSelfJoin 
            ? `[DevNotes Hub] You joined #${groupName}` 
            : `[DevNotes Hub] You've been added to #${groupName}`,
          text: isSelfJoin
            ? `Hello ${targetUsername},\n\nYou have joined the group chat "#${groupName}" via invite link.\n\nOpen chat at: ${process.env.NEXT_PUBLIC_APP_URL || 'https://devnotes-hub.vercel.app'}/group-chat\n\nHappy collaborating!`
            : `Hello ${targetUsername},\n\nYou have been added to the group chat "#${groupName}" by ${session.username}.\n\nJoin the conversation at: ${process.env.NEXT_PUBLIC_APP_URL || 'https://devnotes-hub.vercel.app'}/group-chat\n\nHappy collaborating!`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 500px; border: 1px solid #eee; border-radius: 12px;">
              <h2 style="color: #6366f1; margin-top: 0;">${isSelfJoin ? 'Joined Group Chat 💬' : 'Added to Group Chat 💬'}</h2>
              <p>Hello <strong>${targetUsername}</strong>,</p>
              <p>
                ${isSelfJoin 
                  ? `You have successfully joined the discussion channel <strong>#${groupName}</strong> via an invite link.`
                  : `You've been added to the discussion channel <strong>#${groupName}</strong> by <strong>${session.username}</strong>.`
                }
              </p>
              <p>Join the conversation and start collaborating with your team!</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://devnotes-hub.vercel.app'}/group-chat" style="display:inline-block;background:#6366f1;color:white;text-decoration:none;padding:10px 20px;font-weight:bold;border-radius:8px;margin-top:10px;">Open Group Chat</a>
              <p style="font-size:11px;color:#666;margin-top:20px;">DevNotes Hub — Your collaborative dev prep workspace.</p>
            </div>
          `
        });
      }
    } catch (emailErr) {
      console.warn('[group-chat/members] Failed to send member notification email:', emailErr);
    }

    return NextResponse.json({ success: true, message: `${targetUsername} has been added to the group.` });
  } catch (error: any) {
    console.error('API POST group-chat/members error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/group-chat/members - Remove a member from a group
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const username = searchParams.get('username');

    if (!groupId || !username) {
      return NextResponse.json({ success: false, error: 'Missing groupId or username parameter.' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Check group exists and get creator
    const groupCheck = await pool.request()
      .input('groupId', sql.Int, parseInt(groupId))
      .query('SELECT CreatedBy FROM ChatGroups WHERE Id = @groupId');

    if (groupCheck.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'Group does not exist.' }, { status: 404 });
    }

    const creator = groupCheck.recordset[0].CreatedBy;

    // Only the group creator or Admin can remove members (or a user can leave themselves)
    const canRemove = session.username === username || session.username === creator || session.role === 'Admin';
    if (!canRemove) {
      return NextResponse.json({ success: false, error: 'Only the group creator, an admin, or the user themselves can remove a member.' }, { status: 403 });
    }

    // Cannot remove the creator
    if (username === creator) {
      return NextResponse.json({ success: false, error: 'Cannot remove the group creator.' }, { status: 400 });
    }

    await pool.request()
      .input('groupId', sql.Int, parseInt(groupId))
      .input('username', sql.VarChar, username)
      .query('DELETE FROM ChatGroupMembers WHERE GroupId = @groupId AND Username = @username');

    return NextResponse.json({ success: true, message: `${username} has been removed from the group.` });
  } catch (error: any) {
    console.error('API DELETE group-chat/members error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
