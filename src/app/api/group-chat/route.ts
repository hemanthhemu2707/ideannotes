import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/group-chat - List only groups the logged-in user is a member of
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: true, groups: [] });
    }

    const pool = await getDbPool();

    // Only return groups the user is a member of
    const res = await pool.request()
      .input('username', sql.VarChar, session.username)
      .query(`
        SELECT g.Id as id, g.Name as name, g.Description as description, g.CreatedBy as createdBy, g.CreatedDate as createdDate
        FROM ChatGroups g
        INNER JOIN ChatGroupMembers m ON g.Id = m.GroupId
        WHERE m.Username = @username
        ORDER BY g.Name ASC
      `);

    const groups = res.recordset.map(row => ({
      ...row,
      createdDate: row.createdDate instanceof Date ? row.createdDate.toISOString() : new Date(row.createdDate).toISOString()
    }));

    return NextResponse.json({ success: true, groups });
  } catch (error: any) {
    console.error('API GET group-chat error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/group-chat?groupId=X - Delete an entire chat group (Admin only)
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'Admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized. Only administrators can delete groups.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    if (!groupId) {
      return NextResponse.json({ success: false, error: 'Missing required query parameter: groupId' }, { status: 400 });
    }

    const pool = await getDbPool();
    const gid = parseInt(groupId);

    const groupCheck = await pool.request()
      .input('groupId', sql.Int, gid)
      .query('SELECT Name FROM ChatGroups WHERE Id = @groupId');

    if (groupCheck.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'Chat group not found.' }, { status: 404 });
    }

    const groupName = groupCheck.recordset[0].Name;

    // Delete group — messages and members cascade automatically due to FK constraints
    await pool.request()
      .input('groupId', sql.Int, gid)
      .query('DELETE FROM ChatGroups WHERE Id = @groupId');

    return NextResponse.json({ success: true, message: `Group #${groupName} and all its messages deleted permanently.` });
  } catch (error: any) {
    console.error('API DELETE group-chat error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/group-chat - Create a new chat group and add creator as first member
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ success: false, error: 'Missing required field: name' }, { status: 400 });
    }

    const pool = await getDbPool();
    const cleanName = name.trim();

    // Check uniqueness of group name
    const existsRes = await pool.request()
      .input('name', sql.NVarChar, cleanName)
      .query('SELECT 1 FROM ChatGroups WHERE Name = @name');

    if (existsRes.recordset.length > 0) {
      return NextResponse.json({ success: false, error: 'A chat group with this name already exists.' }, { status: 400 });
    }

    // Insert new group and get the ID back
    const insertRes = await pool.request()
      .input('name', sql.NVarChar, cleanName)
      .input('description', sql.NVarChar, (description || '').trim())
      .input('createdBy', sql.VarChar, session.username)
      .query(`
        INSERT INTO ChatGroups (Name, Description, CreatedBy)
        OUTPUT INSERTED.Id
        VALUES (@name, @description, @createdBy)
      `);

    const newGroupId = insertRes.recordset[0].Id;

    // Add creator as the first member of the group
    await pool.request()
      .input('groupId', sql.Int, newGroupId)
      .input('username', sql.VarChar, session.username)
      .query('INSERT INTO ChatGroupMembers (GroupId, Username) VALUES (@groupId, @username)');

    return NextResponse.json({ success: true, message: 'Group created successfully.', groupId: newGroupId });
  } catch (error: any) {
    console.error('API POST group-chat error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
