import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

// GET /api/checklist - List all checklist guides
export async function GET() {
  try {
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT g.Id as id, g.Title as title, g.CategorySlug as categorySlug, 
             c.Name as categoryName, g.Topic as topic, g.Status as status
      FROM PreparationGuides g
      LEFT JOIN Categories c ON g.CategorySlug = c.Slug
      ORDER BY g.Id ASC
    `);
    return NextResponse.json({ success: true, checklist: res.recordset });
  } catch (error: any) {
    console.error('API GET checklist error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/checklist - Create checklist (Admin only)
export async function POST(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin permissions required.' }, { status: 403 });
    }

    const body = await request.json();
    const { title, categorySlug, topic, status } = body;

    if (!title || !topic) {
      return NextResponse.json({ success: false, error: 'Missing required fields: title, topic' }, { status: 400 });
    }

    const pool = await getDbPool();
    await pool.request()
      .input('title', sql.NVarChar, title)
      .input('categorySlug', sql.VarChar, categorySlug || null)
      .input('topic', sql.NVarChar, topic)
      .input('status', sql.VarChar, status || 'Not Started')
      .query(`
        INSERT INTO PreparationGuides (Title, CategorySlug, Topic, Status)
        VALUES (@title, @categorySlug, @topic, @status)
      `);

    return NextResponse.json({ success: true, message: 'Checklist guide added successfully' });
  } catch (error: any) {
    console.error('API POST checklist error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/checklist - Update checklist status (Admin only)
export async function PUT(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin permissions required.' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, title, topic, categorySlug } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing required field: id' }, { status: 400 });
    }

    const pool = await getDbPool();
    
    if (status !== undefined && title === undefined && topic === undefined) {
      // Just toggle status
      await pool.request()
        .input('id', sql.Int, id)
        .input('status', sql.VarChar, status)
        .query('UPDATE PreparationGuides SET Status = @status WHERE Id = @id');
    } else {
      // Full update
      await pool.request()
        .input('id', sql.Int, id)
        .input('title', sql.NVarChar, title)
        .input('topic', sql.NVarChar, topic)
        .input('categorySlug', sql.VarChar, categorySlug || null)
        .input('status', sql.VarChar, status || 'Not Started')
        .query(`
          UPDATE PreparationGuides
          SET Title = @title, Topic = @topic, CategorySlug = @categorySlug, Status = @status
          WHERE Id = @id
        `);
    }

    return NextResponse.json({ success: true, message: 'Checklist guide updated successfully' });
  } catch (error: any) {
    console.error('API PUT checklist error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/checklist - Delete checklist item (Admin only)
export async function DELETE(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin permissions required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing parameter: id' }, { status: 400 });
    }

    const pool = await getDbPool();
    await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query('DELETE FROM PreparationGuides WHERE Id = @id');

    return NextResponse.json({ success: true, message: 'Checklist guide deleted successfully' });
  } catch (error: any) {
    console.error('API DELETE checklist error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
