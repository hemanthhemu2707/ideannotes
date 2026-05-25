import crypto from 'crypto';
import { cookies } from 'next/headers';

const SECRET_KEY = crypto.createHash('sha256').update(process.env.SESSION_SECRET || 'antigravity-developer-notes-super-secret-key-1337!').digest(); // 32 bytes
const IV_LENGTH = 16; // AES block size
const COOKIE_NAME = 'devnotes-session';

export interface UserSession {
  username: string;
  role: 'Admin' | 'User';
  expires: string;
}

// Encrypt a string to AES-256-CBC
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Decrypt a string
export function decrypt(text: string): string | null {
  try {
    const parts = text.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

// Set session cookie
export async function setSession(username: string, role: 'Admin' | 'User') {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const session: UserSession = { username, role, expires: expires.toISOString() };
  const encrypted = encrypt(JSON.stringify(session));
  
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expires,
    path: '/'
  });
}

// Get and verify session cookie
export async function getSession(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (!cookie || !cookie.value) return null;
    
    const decrypted = decrypt(cookie.value);
    if (!decrypted) return null;
    
    const session = JSON.parse(decrypted) as UserSession;
    if (new Date(session.expires).getTime() < Date.now()) {
      return null; // Session expired
    }
    return session;
  } catch (error) {
    return null;
  }
}

// Clear session cookie
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Check if user is Admin
export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  return session?.role === 'Admin';
}
