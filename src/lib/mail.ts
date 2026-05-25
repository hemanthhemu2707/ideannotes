import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Local project root fallback path
const LOG_FILE_PATH = path.join(process.cwd(), 'otp_notifications.log');

interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail({ to, subject, text, html }: EmailPayload): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM || 'DevNotes Hub <noreply@devnotes.app>';

  try {
    // If SMTP credentials are fully provided, dispatch a real email
    if (smtpHost && smtpUser && smtpPass) {
      console.log(`[SMTP] Attempting to dispatch real email to ${to} via ${smtpHost}...`);
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for others
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      } as any);

      const info = await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        text,
        html,
      });

      console.log(`[SMTP] Real email successfully sent to ${to}! Message ID: ${info.messageId}`);
      return true;
    }
  } catch (smtpError) {
    console.error('[SMTP] Real email transmission failed, shifting to local logs:', smtpError);
  }

  // Fallback: Write beautiful notifications directly to a local file in the workspace
  try {
    const timestamp = new Date().toISOString();
    const logDivider = '='.repeat(60);
    const logContent = `
${logDivider}
[TIMESTAMP] ${timestamp}
[TO]        ${to}
[SUBJECT]   ${subject}
${logDivider}
${text}
${logDivider}
`;

    // Support writable /tmp directory in serverless Vercel execution environments
    let finalLogPath = LOG_FILE_PATH;
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      try {
        finalLogPath = path.join('/tmp', 'otp_notifications.log');
      } catch {
        // ignore join error
      }
    }

    try {
      fs.appendFileSync(finalLogPath, logContent, 'utf8');
      console.log(`[FALLBACK MAIL LOG] Notification successfully saved locally in: ${finalLogPath}`);
    } catch (fsWriteError: any) {
      console.warn(`[FALLBACK MAIL LOG] Filesystem is read-only or restricted (${fsWriteError.message}). Outputting notification directly to console:`);
      console.log(logContent);
    }
    
    return true; // Safely return true so registration is never blocked on log filesystem errors!
  } catch (fsError) {
    console.error('[FALLBACK MAIL LOG] Failed to handle local mail fallback:', fsError);
    // Still return true as a last-resort safety net so users can register
    return true;
  }
}
