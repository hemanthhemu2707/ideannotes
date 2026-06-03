import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/group-chat/users - Get all approved usernames (for adding members)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT Username as username
      FROM Users
      WHERE IsApproved = 1
      ORDER BY Username ASC
    `);

    const users = res.recordset.map(r => r.username);
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error('API GET group-chat/users error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
