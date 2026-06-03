import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyName = searchParams.get('companyName');

    if (!companyName || companyName.trim() === '') {
      return NextResponse.json({ success: true, rounds: [], suggestedRound: '1st Round' });
    }

    const pool = await getDbPool();
    const res = await pool.request()
      .input('companyName', sql.NVarChar, companyName.trim())
      .query(`
        SELECT DISTINCT Round 
        FROM InterviewExperiences 
        WHERE CompanyName = @companyName
      `);

    const rounds: string[] = res.recordset.map(row => row.Round);

    // If no rounds exist, suggest "1st Round"
    if (rounds.length === 0) {
      return NextResponse.json({ success: true, rounds, suggestedRound: '1st Round' });
    }

    // Helper to get ordinal suffix (e.g. 1 -> st, 2 -> nd, 3 -> rd, 4 -> th)
    const getOrdinalSuffix = (num: number): string => {
      const j = num % 10;
      const k = num % 100;
      if (j === 1 && k !== 11) return 'st';
      if (j === 2 && k !== 12) return 'nd';
      if (j === 3 && k !== 13) return 'rd';
      return 'th';
    };

    // Find the maximum round number
    let maxRoundNum = 0;
    let foundNumber = false;

    rounds.forEach(r => {
      // Look for digits in the round name (e.g., "1st Round", "Round 2", "3")
      const match = r.match(/\d+/);
      if (match) {
        const num = parseInt(match[0]);
        if (num > maxRoundNum) {
          maxRoundNum = num;
        }
        foundNumber = true;
      }
    });

    let nextRoundNum = 1;
    if (foundNumber) {
      nextRoundNum = maxRoundNum + 1;
    } else {
      // If no numbers were found in any existing round labels, default to count + 1
      nextRoundNum = rounds.length + 1;
    }

    const suggestedRound = `${nextRoundNum}${getOrdinalSuffix(nextRoundNum)} Round`;

    return NextResponse.json({ success: true, rounds, suggestedRound });
  } catch (error: any) {
    console.error('API GET rounds error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
