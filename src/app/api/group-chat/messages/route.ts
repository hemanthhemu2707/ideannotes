import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/group-chat/messages - Retrieve latest 100 messages for a group chronologically
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    if (!groupId) {
      return NextResponse.json({ success: false, error: 'Missing query parameter: groupId' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Verify user is a member of this group
    const memberCheck = await pool.request()
      .input('groupId', sql.Int, parseInt(groupId))
      .input('username', sql.VarChar, session.username)
      .query('SELECT 1 FROM ChatGroupMembers WHERE GroupId = @groupId AND Username = @username');

    if (memberCheck.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'Not a member of this group.' }, { status: 403 });
    }
    
    const res = await pool.request()
      .input('groupId', sql.Int, parseInt(groupId))
      .query(`
        SELECT id, groupId, username, messageText, createdDate
        FROM (
            SELECT TOP 100 Id as id, GroupId as groupId, Username as username, MessageText as messageText, CreatedDate as createdDate
            FROM ChatMessages
            WHERE GroupId = @groupId
            ORDER BY CreatedDate DESC
        ) sub
        ORDER BY createdDate ASC
      `);

    const messages = res.recordset.map(row => ({
      ...row,
      createdDate: row.createdDate instanceof Date ? row.createdDate.toISOString() : new Date(row.createdDate).toISOString()
    }));

    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    console.error('API GET chat-messages error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/group-chat/messages - Post a new message to a group
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const body = await request.json();
    const { groupId, messageText } = body;

    if (!groupId || !messageText || messageText.trim() === '') {
      return NextResponse.json({ success: false, error: 'Missing required fields: groupId, messageText' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Verify user is a member of this group
    const memberCheck = await pool.request()
      .input('groupId', sql.Int, groupId)
      .input('username', sql.VarChar, session.username)
      .query('SELECT 1 FROM ChatGroupMembers WHERE GroupId = @groupId AND Username = @username');

    if (memberCheck.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'You are not a member of this group.' }, { status: 403 });
    }

    // Insert message
    await pool.request()
      .input('groupId', sql.Int, groupId)
      .input('username', sql.VarChar, session.username)
      .input('messageText', sql.NVarChar, messageText.trim())
      .query(`
        INSERT INTO ChatMessages (GroupId, Username, MessageText)
        VALUES (@groupId, @username, @messageText)
      `);

    return NextResponse.json({ success: true, message: 'Message sent successfully.' });
  } catch (error: any) {
    console.error('API POST chat-messages error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
