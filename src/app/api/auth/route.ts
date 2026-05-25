import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool, hashPassword } from '@/lib/db';
import { getSession, setSession, clearSession } from '@/lib/auth';

// GET /api/auth - Check current session
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: true, user: null });
    }
    return NextResponse.json({ 
      success: true, 
      user: { 
        username: session.username, 
        role: session.role 
      } 
    });
  } catch (error: any) {
    console.error('Auth check error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/auth - Login or Logout
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, username, password } = body;

    if (action === 'logout') {
      await clearSession();
      return NextResponse.json({ success: true, message: 'Logged out successfully' });
    }

    if (action === 'guest') {
      await setSession('Guest', 'User');
      return NextResponse.json({
        success: true,
        user: {
          username: 'Guest',
          role: 'User'
        }
      });
    }

    if (action === 'login') {
      if (!username || !password) {
        return NextResponse.json({ success: false, error: 'Username and password are required' }, { status: 400 });
      }

      const pool = await getDbPool();
      const userRes = await pool.request()
        .input('username', sql.VarChar, username)
        .query('SELECT * FROM Users WHERE Username = @username');

      if (userRes.recordset.length === 0) {
        return NextResponse.json({ success: false, error: 'Invalid username or password' }, { status: 401 });
      }

      const user = userRes.recordset[0];
      const inputHash = hashPassword(password);

      if (user.PasswordHash !== inputHash) {
        return NextResponse.json({ success: false, error: 'Invalid username or password' }, { status: 401 });
      }

      // Establish session
      await setSession(user.Username, user.Role);

      return NextResponse.json({ 
        success: true, 
        user: { 
          username: user.Username, 
          role: user.Role 
        } 
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Auth API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
