import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/mail';

// GET /api/users - List all registered user accounts (Admin Only)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'Admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized administrative access.' }, { status: 403 });
    }

    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT Id, Username, Email, Role, IsApproved 
      FROM Users 
      ORDER BY Role ASC, IsApproved ASC, Username ASC
    `);

    const users = res.recordset.map((row: any) => ({
      id: row.Id,
      username: row.Username,
      email: row.Email || 'No Email Registered',
      role: row.Role,
      isApproved: !!row.IsApproved
    }));

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error('List users API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/users - Toggle user approval status (Admin Only)
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'Admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized administrative access.' }, { status: 403 });
    }

    const body = await request.json();
    const { id, isApproved } = body;

    if (id === undefined || isApproved === undefined) {
      return NextResponse.json({ success: false, error: 'User ID and Approved state are required.' }, { status: 400 });
    }

    const pool = await getDbPool();
    
    // Check if user exists and fetch email
    const userRes = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT Username, Email, Role FROM Users WHERE Id = @id');
      
    if (userRes.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'User account not found.' }, { status: 404 });
    }

    const user = userRes.recordset[0];
    
    if (user.Role === 'Admin') {
      return NextResponse.json({ success: false, error: 'Cannot modify administrative account status.' }, { status: 400 });
    }

    // Perform SQL update
    await pool.request()
      .input('id', sql.Int, id)
      .input('isApproved', sql.Bit, isApproved ? 1 : 0)
      .query('UPDATE Users SET IsApproved = @isApproved WHERE Id = @id');

    // Notify user via Email if approved
    if (isApproved && user.Email) {
      await sendEmail({
        to: user.Email,
        subject: '[DevNotes Hub] Your Reader Account has been Approved!',
        text: `Hello ${user.Username},\n\nGreat news! Your reader registration has been approved by the administrator.\n\nYou can now log in to the workspace and view study notes at: https://devnotes-hub.vercel.app/login\n\nHappy revising!`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 500px; border: 1px solid #eee; border-radius: 12px;">
            <h2 style="color: #10b981; margin-top: 0;">Account Approved! 🎉</h2>
            <p>Hello <strong>${user.Username}</strong>,</p>
            <p>Your reader registration has been successfully verified and approved by the workspace administrator!</p>
            <p>You now have full read-only access to premium software engineering notebooks, diagrams, and checklists.</p>
            
            <a href="https://devnotes-hub.vercel.app/login" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 10px 20px; font-weight: bold; border-radius: 8px; margin-top: 10px;">Sign In to Workspace</a>
            
            <p style="font-size: 11px; color: #666; margin-top: 20px;">If you have any doubts, you can also ask our AI Doubt Solver in the chatroom once logged in!</p>
          </div>
        `
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: isApproved ? 'User approved successfully and notified!' : 'User approval status revoked.' 
    });
  } catch (error: any) {
    console.error('Update user API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/users - Delete a user account (Admin Only)
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'Admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized administrative access.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');

    if (!idParam) {
      return NextResponse.json({ success: false, error: 'User ID parameter is required.' }, { status: 400 });
    }

    const id = parseInt(idParam);
    const pool = await getDbPool();

    // Check if user is Admin
    const userRes = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT Role FROM Users WHERE Id = @id');
      
    if (userRes.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'User account not found.' }, { status: 404 });
    }

    if (userRes.recordset[0].Role === 'Admin') {
      return NextResponse.json({ success: false, error: 'Cannot delete administrative accounts.' }, { status: 400 });
    }

    // Delete user
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Users WHERE Id = @id');

    return NextResponse.json({ success: true, message: 'User account deleted successfully.' });
  } catch (error: any) {
    console.error('Delete user API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
