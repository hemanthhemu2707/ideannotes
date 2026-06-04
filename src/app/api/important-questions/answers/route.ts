import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/important-questions/answers - Retrieve answers for a question
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');

    if (!questionId) {
      return NextResponse.json({ success: false, error: 'Missing required query parameter: questionId' }, { status: 400 });
    }

    const pool = await getDbPool();
    const answersRes = await pool.request()
      .input('questionId', sql.Int, parseInt(questionId))
      .query(`
        SELECT Id as id, QuestionId as questionId, Username as username, AnswerText as answerText, CreatedDate as createdDate, UpdatedDate as updatedDate
        FROM ImportantAnswers
        WHERE QuestionId = @questionId
        ORDER BY CreatedDate ASC
      `);

    return NextResponse.json({ success: true, answers: answersRes.recordset });
  } catch (error: any) {
    console.error('API GET important-questions/answers error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/important-questions/answers - Add or update an answer
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const body = await request.json();
    const { questionId, answerText } = body;

    if (!questionId || !answerText || answerText.trim() === '') {
      return NextResponse.json({ success: false, error: 'Missing required fields: questionId or answerText.' }, { status: 400 });
    }

    const pool = await getDbPool();
    const qId = parseInt(questionId);

    // Verify Question exists
    const qCheck = await pool.request()
      .input('id', sql.Int, qId)
      .query('SELECT Id FROM ImportantQuestions WHERE Id = @id');

    if (qCheck.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'Question not found.' }, { status: 404 });
    }

    // Check if user already has an answer for this question. If yes, update it; otherwise insert.
    // This maintains one answer per user per question.
    const answerCheck = await pool.request()
      .input('questionId', sql.Int, qId)
      .input('username', sql.VarChar, session.username)
      .query('SELECT Id FROM ImportantAnswers WHERE QuestionId = @questionId AND Username = @username');

    if (answerCheck.recordset.length > 0) {
      // Update existing
      const answerId = answerCheck.recordset[0].Id;
      await pool.request()
        .input('id', sql.Int, answerId)
        .input('answerText', sql.NVarChar, answerText.trim())
        .query('UPDATE ImportantAnswers SET AnswerText = @answerText, UpdatedDate = GETDATE() WHERE Id = @id');

      return NextResponse.json({ success: true, message: 'Answer updated successfully.', answerId });
    } else {
      // Insert new
      const insertRes = await pool.request()
        .input('questionId', sql.Int, qId)
        .input('username', sql.VarChar, session.username)
        .input('answerText', sql.NVarChar, answerText.trim())
        .query(`
          INSERT INTO ImportantAnswers (QuestionId, Username, AnswerText)
          OUTPUT INSERTED.Id
          VALUES (@questionId, @username, @answerText)
        `);

      const answerId = insertRes.recordset[0].Id;
      return NextResponse.json({ success: true, message: 'Answer added successfully.', answerId });
    }
  } catch (error: any) {
    console.error('API POST important-questions/answers error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/important-questions/answers - Delete an answer
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
    const answerId = parseInt(id);

    // Fetch answer to verify owner
    const checkRes = await pool.request()
      .input('id', sql.Int, answerId)
      .query('SELECT Username FROM ImportantAnswers WHERE Id = @id');

    if (checkRes.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'Answer not found.' }, { status: 404 });
    }

    const username = checkRes.recordset[0].Username;

    // Authorize: Admin or Creator
    const isAuthorized = session.role === 'Admin' || username.toLowerCase() === session.username.toLowerCase();
    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: 'Forbidden. You do not have permission to delete this answer.' }, { status: 403 });
    }

    await pool.request()
      .input('id', sql.Int, answerId)
      .query('DELETE FROM ImportantAnswers WHERE Id = @id');

    return NextResponse.json({ success: true, message: 'Answer deleted successfully.' });
  } catch (error: any) {
    console.error('API DELETE important-questions/answers error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
