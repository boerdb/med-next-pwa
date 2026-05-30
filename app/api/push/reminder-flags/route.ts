import type { NextRequest } from 'next/server';
import { requireSession, jsonError, jsonOk } from '@/lib/api/http';
import { getReminderFlags } from '@/lib/push/store';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof Response) return session;

  try {
    const dateKey = req.nextUrl.searchParams.get('dateKey');
    if (dateKey && !DATE_KEY_RE.test(dateKey)) {
      return jsonError('Ongeldige datum.', 400);
    }

    const allFlags = await getReminderFlags(session.userId);
    const flags = dateKey
      ? Object.fromEntries(
          Object.entries(allFlags).filter(([slotKey]) => slotKey.startsWith(`${dateKey}::`)),
        )
      : allFlags;

    return jsonOk({ flags });
  } catch (e) {
    console.error('push reminder-flags GET', e);
    return jsonError('Kon reminder-status niet laden.', 500);
  }
}
