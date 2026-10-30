import { cookies } from 'next/headers';
import crypto from 'crypto';

const COOKIE = 'wl_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 zile

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET lipsește din mediu.');
  return s;
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

// Token = userId.signature
export function createToken(userId) {
  return `${userId}.${sign(userId)}`;
}

function verifyToken(token) {
  if (!token) return null;
  const i = token.lastIndexOf('.');
  if (i < 0) return null;
  const userId = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = sign(userId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return userId;
}

export async function setSession(userId) {
  const store = await cookies();
  store.set(COOKIE, createToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getUserId() {
  const store = await cookies();
  return verifyToken(store.get(COOKIE)?.value);
}

// Variantă pentru middleware (primește request-ul)
export function getUserIdFromRequest(req) {
  return verifyToken(req.cookies.get(COOKIE)?.value);
}
