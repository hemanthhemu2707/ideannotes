import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/group-chat/unread - Count unread messages for the authenticated user
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: true, unreadCount: 0, unreadGroups: [] });
    }

    const pool = await getDbPool();

    // Query unread count grouped by chat group
    const res = await pool.request()
      .input('username', sql.VarChar, session.username)
      .query(`
        SELECT 
          g.Id as id, 
          g.Name as name, 
          COUNT(msg.Id) as unreadCount, 
          MAX(msg.CreatedDate) as lastMessageDate,
          (
            SELECT TOP 1 SUBSTRING(m2.MessageText, 1, 60)
            FROM ChatMessages m2 
            WHERE m2.GroupId = g.Id AND m2.Username <> @username
            ORDER BY m2.CreatedDate DESC
          ) as lastMessageSnippet
        FROM ChatGroupMembers m
        INNER JOIN ChatGroups g ON m.GroupId = g.Id
        INNER JOIN ChatMessages msg ON m.GroupId = msg.GroupId
        WHERE m.Username = @username
          AND msg.Username <> @username
          AND msg.CreatedDate > COALESCE(m.LastReadDate, m.JoinedDate)
        GROUP BY g.Id, g.Name
        ORDER BY lastMessageDate DESC
      `);

    const unreadGroups = res.recordset.map(row => ({
      id: row.id,
      name: row.name,
      unreadCount: row.unreadCount,
      lastMessageDate: row.lastMessageDate instanceof Date ? row.lastMessageDate.toISOString() : new Date(row.lastMessageDate).toISOString(),
      snippet: row.lastMessageSnippet || 'New message'
    }));

    const totalUnreadCount = unreadGroups.reduce((acc, curr) => acc + curr.unreadCount, 0);

    return NextResponse.json({ 
      success: true, 
      unreadCount: totalUnreadCount, 
      unreadGroups 
    });
  } catch (error: any) {
    console.error('API GET group-chat/unread error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
