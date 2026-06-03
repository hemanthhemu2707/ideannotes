import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/interviews - Retrieve all interview experiences hierarchically
export async function GET() {
  try {
    const pool = await getDbPool();

    // Fetch experiences
    const experiencesRes = await pool.request().query(`
      SELECT Id as id, CompanyName as companyName, Round as round, InterviewDate as interviewDate, InterviewerName as interviewerName, CreatedDate as createdDate
      FROM InterviewExperiences
      ORDER BY InterviewDate DESC, CreatedDate DESC
    `);

    // Fetch all questions
    const questionsRes = await pool.request().query(`
      SELECT Id as id, ExperienceId as experienceId, QuestionText as questionText
      FROM InterviewQuestions
    `);

    // Fetch all answers
    const answersRes = await pool.request().query(`
      SELECT Id as id, QuestionId as questionId, Username as username, AnswerText as answerText, UpdatedDate as updatedDate
      FROM InterviewAnswers
      ORDER BY UpdatedDate ASC
    `);

    const experiencesList = experiencesRes.recordset;
    const questionsList = questionsRes.recordset;
    const answersList = answersRes.recordset;

    // Group answers by question ID
    const answersByQuestionMap: Record<number, any[]> = {};
    answersList.forEach(ans => {
      if (!answersByQuestionMap[ans.questionId]) {
        answersByQuestionMap[ans.questionId] = [];
      }
      answersByQuestionMap[ans.questionId].push({
        id: ans.id,
        username: ans.username,
        answerText: ans.answerText,
        updatedDate: ans.updatedDate instanceof Date ? ans.updatedDate.toISOString() : new Date(ans.updatedDate).toISOString()
      });
    });

    // Group questions by experience ID
    const questionsByExperienceMap: Record<number, any[]> = {};
    questionsList.forEach(q => {
      if (!questionsByExperienceMap[q.experienceId]) {
        questionsByExperienceMap[q.experienceId] = [];
      }
      questionsByExperienceMap[q.experienceId].push({
        id: q.id,
        questionText: q.questionText,
        answers: answersByQuestionMap[q.id] || []
      });
    });

    // Map into final hierarchical structure
    const experiences = experiencesList.map(exp => ({
      id: exp.id,
      companyName: exp.companyName,
      round: exp.round,
      interviewDate: exp.interviewDate instanceof Date ? exp.interviewDate.toISOString() : new Date(exp.interviewDate).toISOString(),
      interviewerName: exp.interviewerName,
      createdDate: exp.createdDate instanceof Date ? exp.createdDate.toISOString() : new Date(exp.createdDate).toISOString(),
      questions: questionsByExperienceMap[exp.id] || []
    }));

    return NextResponse.json({ success: true, experiences });
  } catch (error: any) {
    console.error('API GET interviews error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/interviews - Share a new interview experience
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const body = await request.json();
    const { companyName, round, interviewDate, questions } = body;

    if (!companyName || !round || !interviewDate || !questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields or questions array is empty.' }, { status: 400 });
    }

    const pool = await getDbPool();
    
    // 1. Insert InterviewExperience and get its Id
    const expInsert = await pool.request()
      .input('companyName', sql.NVarChar, companyName.trim())
      .input('round', sql.NVarChar, round.trim())
      .input('interviewDate', sql.DateTime2, new Date(interviewDate))
      .input('interviewerName', sql.NVarChar, session.username)
      .query(`
        INSERT INTO InterviewExperiences (CompanyName, Round, InterviewDate, InterviewerName)
        OUTPUT INSERTED.Id
        VALUES (@companyName, @round, @interviewDate, @interviewerName)
      `);

    const experienceId = expInsert.recordset[0].Id;

    // 2. Loop and insert each Question
    for (const q of questions) {
      if (!q.questionText || q.questionText.trim() === '') continue;

      const qInsert = await pool.request()
        .input('experienceId', sql.Int, experienceId)
        .input('questionText', sql.NVarChar, q.questionText.trim())
        .query(`
          INSERT INTO InterviewQuestions (ExperienceId, QuestionText)
          OUTPUT INSERTED.Id
          VALUES (@experienceId, @questionText)
        `);

      const questionId = qInsert.recordset[0].Id;

      // 3. If there is an optional answer provided, insert it
      if (q.answerText && q.answerText.trim() !== '') {
        await pool.request()
          .input('questionId', sql.Int, questionId)
          .input('username', sql.VarChar, session.username)
          .input('answerText', sql.NVarChar, q.answerText.trim())
          .query(`
            INSERT INTO InterviewAnswers (QuestionId, Username, AnswerText)
            VALUES (@questionId, @username, @answerText)
          `);
      }
    }

    return NextResponse.json({ success: true, experienceId });
  } catch (error: any) {
    console.error('API POST interview error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/interviews - Delete a shared interview experience (Admin or Submitter only)
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing required query parameter: id' }, { status: 400 });
    }

    const pool = await getDbPool();
    const expId = parseInt(id);

    // Fetch owner of the experience
    const checkRes = await pool.request()
      .input('id', sql.Int, expId)
      .query('SELECT InterviewerName FROM InterviewExperiences WHERE Id = @id');

    if (checkRes.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'Interview experience not found.' }, { status: 404 });
    }

    const interviewerName = checkRes.recordset[0].InterviewerName;

    // Authorize: Must be Admin OR the user who created it
    const isAuthorized = session.role === 'Admin' || interviewerName.toLowerCase() === session.username.toLowerCase();
    
    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: 'Forbidden. You do not have permission to delete this experience.' }, { status: 403 });
    }

    // Delete experience (cascades to questions and answers due to constraints)
    await pool.request()
      .input('id', sql.Int, expId)
      .query('DELETE FROM InterviewExperiences WHERE Id = @id');

    return NextResponse.json({ success: true, message: 'Interview experience deleted successfully.' });
  } catch (error: any) {
    console.error('API DELETE interview error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
