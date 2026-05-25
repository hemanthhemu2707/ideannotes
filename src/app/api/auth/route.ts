import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDbPool, hashPassword } from '@/lib/db';
import { getSession, setSession, clearSession } from '@/lib/auth';
import { sendEmail } from '@/lib/mail';

// GET /api/auth - Check current session
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: true, user: null });
    }

    // Retrieve full user detail from database to ensure up-to-date role/approval status
    const pool = await getDbPool();
    const userRes = await pool.request()
      .input('username', sql.VarChar, session.username)
      .query('SELECT Role, IsApproved, Email FROM Users WHERE Username = @username');
    
    if (userRes.recordset.length === 0) {
      await clearSession();
      return NextResponse.json({ success: true, user: null });
    }

    const user = userRes.recordset[0];

    // Block session if unapproved
    if (user.Role !== 'Admin' && !user.IsApproved) {
      await clearSession();
      return NextResponse.json({ success: true, user: null });
    }

    return NextResponse.json({ 
      success: true, 
      user: { 
        username: session.username, 
        role: user.Role,
        email: user.Email
      } 
    });
  } catch (error: any) {
    console.error('Auth check error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/auth - Login, Logout, and Registration
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, username, password } = body;

    // 1. Logout
    if (action === 'logout') {
      await clearSession();
      return NextResponse.json({ success: true, message: 'Logged out successfully' });
    }

    // 2. Login (Username or Email lookup)
    if (action === 'login') {
      if (!username || !password) {
        return NextResponse.json({ success: false, error: 'Username/Email and password are required.' }, { status: 400 });
      }

      const pool = await getDbPool();
      const userRes = await pool.request()
        .input('username', sql.VarChar, username.trim())
        .query('SELECT * FROM Users WHERE Username = @username OR Email = @username');

      if (userRes.recordset.length === 0) {
        return NextResponse.json({ success: false, error: 'Invalid username or password.' }, { status: 401 });
      }

      const user = userRes.recordset[0];
      const inputHash = hashPassword(password);

      if (user.PasswordHash !== inputHash) {
        return NextResponse.json({ success: false, error: 'Invalid username or password.' }, { status: 401 });
      }

      // Enforce Admin approvals (all standard users must be approved)
      if (user.Role !== 'Admin' && !user.IsApproved) {
        return NextResponse.json({ 
          success: false, 
          error: 'Your account is pending approval by the administrator (hemanthhemu2707@gmail.com). You will be allowed access once approved.' 
        }, { status: 403 });
      }

      // Establish session
      await setSession(user.Username, user.Role);

      return NextResponse.json({ 
        success: true, 
        user: { 
          username: user.Username, 
          role: user.Role,
          email: user.Email
        } 
      });
    }

    // 3. Dispatch Verification OTP
    if (action === 'send-otp') {
      const { email } = body;
      if (!email) {
        return NextResponse.json({ success: false, error: 'Email address is required.' }, { status: 400 });
      }

      const pool = await getDbPool();

      // Check if email already belongs to a registered user
      const userRes = await pool.request()
        .input('email', sql.VarChar, email.trim())
        .query('SELECT Username FROM Users WHERE Email = @email');

      if (userRes.recordset.length > 0) {
        return NextResponse.json({ success: false, error: 'An account is already registered with this email address.' }, { status: 400 });
      }

      // Generate a 6-digit random verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Upsert into OtpCodes
      await pool.request()
        .input('email', sql.VarChar, email.trim())
        .input('code', sql.VarChar, code)
        .input('expiresAt', sql.DateTime2, expiresAt)
        .query(`
          MERGE INTO OtpCodes AS Target
          USING (SELECT @email AS Email) AS Source
          ON Target.Email = Source.Email
          WHEN MATCHED THEN
            UPDATE SET Code = @code, ExpiresAt = @expiresAt
          WHEN NOT MATCHED THEN
            INSERT (Email, Code, ExpiresAt) VALUES (@email, @code, @expiresAt);
        `);

      // Dispatch Email
      const emailSent = await sendEmail({
        to: email.trim(),
        subject: '[DevNotes Hub] Your Email Verification OTP Code',
        text: `Your 6-digit verification code is: ${code}\n\nIt is valid for 10 minutes. If you did not request this code, please ignore this email.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 500px; border: 1px solid #eee; border-radius: 12px;">
            <h2 style="color: #6366f1;">Verify Your Email Address</h2>
            <p>Thank you for registering at DevNotes Hub! Please use the following One-Time Password (OTP) to complete your signup:</p>
            <div style="font-size: 24px; font-weight: bold; background: #f3f4f6; color: #4338ca; padding: 12px 20px; border-radius: 8px; width: max-content; margin: 20px 0; letter-spacing: 4px;">
              ${code}
            </div>
            <p style="font-size: 12px; color: #666;">This code is valid for 10 minutes. If you did not make this request, you can safely ignore this email.</p>
          </div>
        `
      });

      if (!emailSent) {
        return NextResponse.json({ success: false, error: 'Failed to generate and dispatch verification code.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Verification code dispatched successfully!' });
    }

    // 4. Verify OTP and Create Pending User
    if (action === 'verify-and-register') {
      const { username, email, password, code } = body;

      if (!username || !email || !password || !code) {
        return NextResponse.json({ success: false, error: 'All fields (Display Name, Email, Password, OTP Code) are required.' }, { status: 400 });
      }

      const pool = await getDbPool();

      // Check if email already belongs to a registered user
      const userCheck = await pool.request()
        .input('email', sql.VarChar, email.trim())
        .query('SELECT Username FROM Users WHERE Email = @email');

      if (userCheck.recordset.length > 0) {
        return NextResponse.json({ success: false, error: 'An account is already registered with this email address.' }, { status: 400 });
      }

      // Verify OTP Code
      const otpRes = await pool.request()
        .input('email', sql.VarChar, email.trim())
        .query('SELECT * FROM OtpCodes WHERE Email = @email');

      if (otpRes.recordset.length === 0) {
        return NextResponse.json({ success: false, error: 'No verification code found. Please request a new OTP.' }, { status: 400 });
      }

      const otp = otpRes.recordset[0];

      if (otp.Code !== code.trim()) {
        return NextResponse.json({ success: false, error: 'Incorrect verification code. Please try again.' }, { status: 400 });
      }

      if (new Date(otp.ExpiresAt).getTime() < Date.now()) {
        return NextResponse.json({ success: false, error: 'Verification code has expired. Please request a new OTP.' }, { status: 400 });
      }

      // Delete the verified OTP
      await pool.request()
        .input('email', sql.VarChar, email.trim())
        .query('DELETE FROM OtpCodes WHERE Email = @email');

      // Create new user (pending approval: IsApproved = 0)
      const passHash = hashPassword(password);
      await pool.request()
        .input('username', sql.VarChar, username.trim())
        .input('email', sql.VarChar, email.trim())
        .input('hash', sql.VarChar, passHash)
        .input('role', sql.VarChar, 'User')
        .query('INSERT INTO Users (Username, PasswordHash, Role, Email, IsApproved) VALUES (@username, @hash, @role, @email, 0)');

      // Send admin notification to hemanthhemu2707@gmail.com
      const adminEmail = 'hemanthhemu2707@gmail.com';
      await sendEmail({
        to: adminEmail,
        subject: `[DevNotes Admin Alert] New User Signup Pending Approval: ${username}`,
        text: `A new user has registered and is pending your approval to access the workspace:\n\nUser: ${username}\nEmail: ${email}\n\nPlease log in to your Control Center at https://devnotes-hub.vercel.app/manage under the 'User Accounts' tab to approve this reader.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #eee; border-radius: 12px;">
            <h2 style="color: #4f46e5; margin-top: 0;">New User Signup Pending</h2>
            <p>A new developer has verified their email and is waiting for your authorization to read notes:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
              <tr style="background: #f9fafb;">
                <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #eee; width: 120px;">Display Name</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${username}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #eee;">Email Address</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="mailto:${email}" style="color: #6366f1;">${email}</a></td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #eee;">Status</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;"><span style="color: #d97706; font-weight: bold;">Pending Approval</span></td>
              </tr>
            </table>
            
            <p>Please log in as Administrator and navigate to the **Control Center** to approve this user:</p>
            <a href="https://devnotes-hub.vercel.app/manage" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 10px 20px; font-weight: bold; border-radius: 8px; margin-top: 10px;">Open Control Center</a>
          </div>
        `
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Account registered successfully! Your registration is now pending approval by the administrator (hemanthhemu2707@gmail.com). You will be allowed access once approved.' 
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Auth API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
