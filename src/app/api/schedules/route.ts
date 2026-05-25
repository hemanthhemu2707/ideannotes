import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

// GET /api/schedules - List all schedules
export async function GET() {
  try {
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT Id as id, Company as company, Role as role, ScheduleDate as scheduleDate, Notes as notes, Completed as completed 
      FROM InterviewSchedules
      ORDER BY Completed ASC, ScheduleDate ASC
    `);
    
    // Convert Dates to ISO strings
    const schedules = res.recordset.map(row => ({
      ...row,
      scheduleDate: row.scheduleDate instanceof Date ? row.scheduleDate.toISOString() : new Date(row.scheduleDate).toISOString(),
      completed: !!row.completed
    }));
    
    return NextResponse.json({ success: true, schedules });
  } catch (error: any) {
    console.error('API GET schedules error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/schedules - Add a schedule (Admin only)
export async function POST(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin permissions required.' }, { status: 403 });
    }

    const body = await request.json();
    const { company, role, scheduleDate, notes } = body;

    if (!company || !role || !scheduleDate) {
      return NextResponse.json({ success: false, error: 'Missing required fields: company, role, scheduleDate' }, { status: 400 });
    }

    const pool = await getDbPool();
    await pool.request()
      .input('company', sql.NVarChar, company)
      .input('role', sql.NVarChar, role)
      .input('scheduleDate', sql.DateTime2, new Date(scheduleDate))
      .input('notes', sql.NVarChar, notes || '')
      .query(`
        INSERT INTO InterviewSchedules (Company, Role, ScheduleDate, Notes, Completed)
        VALUES (@company, @role, @scheduleDate, @notes, 0)
      `);

    return NextResponse.json({ success: true, message: 'Schedule created successfully' });
  } catch (error: any) {
    console.error('API POST schedule error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/schedules - Update a schedule (Admin only)
export async function PUT(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin permissions required.' }, { status: 403 });
    }

    const body = await request.json();
    const { id, company, role, scheduleDate, notes, completed } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing required field: id' }, { status: 400 });
    }

    const pool = await getDbPool();
    await pool.request()
      .input('id', sql.Int, id)
      .input('company', sql.NVarChar, company)
      .input('role', sql.NVarChar, role)
      .input('scheduleDate', sql.DateTime2, new Date(scheduleDate))
      .input('notes', sql.NVarChar, notes || '')
      .input('completed', sql.Bit, completed ? 1 : 0)
      .query(`
        UPDATE InterviewSchedules
        SET Company = @company, Role = @role, ScheduleDate = @scheduleDate, Notes = @notes, Completed = @completed
        WHERE Id = @id
      `);

    return NextResponse.json({ success: true, message: 'Schedule updated successfully' });
  } catch (error: any) {
    console.error('API PUT schedule error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/schedules - Delete a schedule (Admin only)
export async function DELETE(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin permissions required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Schedule id parameter is required' }, { status: 400 });
    }

    const pool = await getDbPool();
    await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query('DELETE FROM InterviewSchedules WHERE Id = @id');

    return NextResponse.json({ success: true, message: 'Schedule deleted successfully' });
  } catch (error: any) {
    console.error('API DELETE schedule error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
