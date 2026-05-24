import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

export const SESSION_COOKIE = 'medtracker_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = {
  userId: string;
  email: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set (min 32 characters)');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = payload.userId;
    const email = payload.email;
    if (typeof userId !== 'string' || typeof email !== 'string') return null;
    return { userId, email };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(token: string) {
  const secure = process.env.NODE_ENV === 'production';
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE_SEC,
  };
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
