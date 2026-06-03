import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/interviews/answers - Create or update an answer to a question
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const body = await request.json();
    const { questionId, answerText } = body;

    if (!questionId || answerText === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields: questionId, answerText' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Perform Upsert (Update if exists, else Insert)
    await pool.request()
      .input('questionId', sql.Int, questionId)
      .input('username', sql.VarChar, session.username)
      .input('answerText', sql.NVarChar, answerText.trim())
      .query(`
        IF EXISTS (SELECT 1 FROM InterviewAnswers WHERE QuestionId = @questionId AND Username = @username)
        BEGIN
            UPDATE InterviewAnswers 
            SET AnswerText = @answerText, UpdatedDate = GETDATE() 
            WHERE QuestionId = @questionId AND Username = @username;
        END
        ELSE
        BEGIN
            INSERT INTO InterviewAnswers (QuestionId, Username, AnswerText) 
            VALUES (@questionId, @username, @answerText);
        END
      `);

    return NextResponse.json({ success: true, message: 'Answer saved successfully.' });
  } catch (error: any) {
    console.error('API POST answer error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
