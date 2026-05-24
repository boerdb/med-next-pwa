import { SESSION_COOKIE } from '@/lib/auth/session';
import { jsonOk } from '@/lib/api/http';

export async function POST() {
  const res = jsonOk({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
