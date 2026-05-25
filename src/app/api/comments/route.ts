import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool } from '@/lib/db';
import { getSession, isAdmin } from '@/lib/auth';

// GET /api/comments?noteSlug=... - Fetch all comments for a note
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const noteSlug = searchParams.get('noteSlug');
    
    if (!noteSlug) {
      return NextResponse.json({ success: false, error: 'noteSlug is required' }, { status: 400 });
    }
    
    const pool = await getDbPool();
    const res = await pool.request()
      .input('noteSlug', sql.VarChar, noteSlug)
      .query(`
        SELECT Id as id, NoteSlug as noteSlug, Author as author, Email as email, Content as content, CreatedDate as createdDate
        FROM Comments
        WHERE NoteSlug = @noteSlug
        ORDER BY CreatedDate DESC
      `);
      
    return NextResponse.json({ success: true, comments: res.recordset });
  } catch (error: any) {
    console.error('Fetch comments error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/comments - Post a new comment
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Authentication required. Please sign in.' }, { status: 401 });
    }

    const body = await request.json();
    const { noteSlug, content } = body;
    
    if (!noteSlug || !content) {
      return NextResponse.json({ success: false, error: 'noteSlug and content are required' }, { status: 400 });
    }
    
    const pool = await getDbPool();
    
    // Retrieve registered user details from Database to ensure we store verified Email and Name
    const userRes = await pool.request()
      .input('username', sql.VarChar, session.username)
      .query('SELECT Username, Email, Role FROM Users WHERE Username = @username');
      
    if (userRes.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404 });
    }

    const user = userRes.recordset[0];
    const finalAuthor = user.Username;
    const finalEmail = user.Email || 'No Email';
    
    // Verify note exists
    const noteCheck = await pool.request()
      .input('noteSlug', sql.VarChar, noteSlug)
      .query('SELECT Slug FROM Notes WHERE Slug = @noteSlug');
      
    if (noteCheck.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 });
    }
    
    const res = await pool.request()
      .input('noteSlug', sql.VarChar, noteSlug)
      .input('author', sql.NVarChar, finalAuthor)
      .input('email', sql.VarChar, finalEmail)
      .input('content', sql.NVarChar, content)
      .query(`
        INSERT INTO Comments (NoteSlug, Author, Email, Content, CreatedDate)
        OUTPUT INSERTED.Id as id, INSERTED.NoteSlug as noteSlug, INSERTED.Author as author, INSERTED.Email as email, INSERTED.Content as content, INSERTED.CreatedDate as createdDate
        VALUES (@noteSlug, @author, @email, @content, GETDATE())
      `);
      
    return NextResponse.json({ success: true, comment: res.recordset[0] });
  } catch (error: any) {
    console.error('Post comment error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/comments?id=... - Delete a comment (Admin only)
export async function DELETE(request: Request) {
  try {
    const adminAccess = await isAdmin();
    if (!adminAccess) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const idStr = searchParams.get('id');
    
    if (!idStr) {
      return NextResponse.json({ success: false, error: 'Comment id is required' }, { status: 400 });
    }
    
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid comment id' }, { status: 400 });
    }
    
    const pool = await getDbPool();
    const res = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Comments WHERE Id = @id');
      
    if ((res.rowsAffected[0] || 0) === 0) {
      return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error: any) {
    console.error('Delete comment error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
