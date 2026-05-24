import { randomUUID } from 'crypto';
import { getPool } from '@/lib/db/mysql';
import { hashPassword, validateEmail, validatePassword } from '@/lib/auth/password';
import {
  createSessionToken,
  sessionCookieOptions,
} from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/api/http';
import type { RowDataPacket } from 'mysql2';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() ?? '';
    const password = body.password ?? '';

    const emailErr = validateEmail(email);
    if (emailErr) return jsonError(emailErr, 400);
    const passErr = validatePassword(password);
    if (passErr) return jsonError(passErr, 400);

    const pool = getPool();
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email],
    );
    if (existing.length > 0) {
      return jsonError('Dit e-mailadres is al geregistreerd.', 409);
    }

    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    await pool.query(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      [id, email, passwordHash],
    );

    const token = await createSessionToken({ userId: id, email });
    const res = jsonOk({ user: { id, email } });
    res.cookies.set(sessionCookieOptions(token));
    return res;
  } catch (e) {
    console.error('register', e);
    return jsonError('Registreren mislukt.', 500);
  }
}
