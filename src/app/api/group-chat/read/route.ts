import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/group-chat/read - Update LastReadDate for a group member
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { groupId } = body;

    if (!groupId) {
      return NextResponse.json({ success: false, error: 'Missing required field: groupId' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Check if the user is a member of this group
    const memberCheck = await pool.request()
      .input('groupId', sql.Int, groupId)
      .input('username', sql.VarChar, session.username)
      .query('SELECT 1 FROM ChatGroupMembers WHERE GroupId = @groupId AND Username = @username');

    if (memberCheck.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'You are not a member of this group.' }, { status: 403 });
    }

    // Update LastReadDate
    await pool.request()
      .input('groupId', sql.Int, groupId)
      .input('username', sql.VarChar, session.username)
      .query('UPDATE ChatGroupMembers SET LastReadDate = GETDATE() WHERE GroupId = @groupId AND Username = @username');

    return NextResponse.json({ success: true, message: 'Group marked as read.' });
  } catch (error: any) {
    console.error('API POST group-chat/read error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
