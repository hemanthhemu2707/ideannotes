import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/important-questions - Retrieve all important questions
export async function GET() {
  try {
    const pool = await getDbPool();
    const questionsRes = await pool.request().query(`
      SELECT q.Id as id, q.CategorySlug as categorySlug, q.QuestionText as questionText, q.CreatedBy as createdBy, q.CreatedDate as createdDate,
             (SELECT COUNT(*) FROM ImportantAnswers WHERE QuestionId = q.Id) as answersCount
      FROM ImportantQuestions q
      ORDER BY q.CreatedDate DESC
    `);
    return NextResponse.json({ success: true, questions: questionsRes.recordset });
  } catch (error: any) {
    console.error('API GET important-questions error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/important-questions - Create a new important question
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const body = await request.json();
    const { categorySlug, questionText } = body;

    if (!categorySlug || !questionText || questionText.trim() === '') {
      return NextResponse.json({ success: false, error: 'Missing required fields: categorySlug or questionText.' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Verify CategorySlug exists in Categories
    const catCheck = await pool.request()
      .input('slug', sql.VarChar, categorySlug)
      .query('SELECT Slug FROM Categories WHERE Slug = @slug');

    if (catCheck.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'Category or Subcategory does not exist.' }, { status: 404 });
    }

    const insertRes = await pool.request()
      .input('categorySlug', sql.VarChar, categorySlug)
      .input('questionText', sql.NVarChar, questionText.trim())
      .input('createdBy', sql.VarChar, session.username)
      .query(`
        INSERT INTO ImportantQuestions (CategorySlug, QuestionText, CreatedBy)
        OUTPUT INSERTED.Id
        VALUES (@categorySlug, @questionText, @createdBy)
      `);

    const questionId = insertRes.recordset[0].Id;
    return NextResponse.json({ success: true, questionId });
  } catch (error: any) {
    console.error('API POST important-questions error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/important-questions - Delete a question
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing query parameter: id' }, { status: 400 });
    }

    const pool = await getDbPool();
    const questionId = parseInt(id);

    // Fetch the question to check owner
    const checkRes = await pool.request()
      .input('id', sql.Int, questionId)
      .query('SELECT CreatedBy FROM ImportantQuestions WHERE Id = @id');

    if (checkRes.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'Question not found.' }, { status: 404 });
    }

    const createdBy = checkRes.recordset[0].CreatedBy;

    // Check authority: Admin or Creator
    const isAuthorized = session.role === 'Admin' || createdBy.toLowerCase() === session.username.toLowerCase();
    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: 'Forbidden. You do not have permission to delete this question.' }, { status: 403 });
    }

    await pool.request()
      .input('id', sql.Int, questionId)
      .query('DELETE FROM ImportantQuestions WHERE Id = @id');

    return NextResponse.json({ success: true, message: 'Question deleted successfully.' });
  } catch (error: any) {
    console.error('API DELETE important-questions error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
