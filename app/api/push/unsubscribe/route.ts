import type { NextRequest } from 'next/server';
import { requireSession, jsonError, jsonOk } from '@/lib/api/http';
import { deletePushSubscription } from '@/lib/push/store';

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof Response) return session;

  try {
    const body = (await req.json()) as { endpoint?: string };
    if (!body.endpoint) {
      return jsonError('Geen endpoint.', 400);
    }
    await deletePushSubscription(body.endpoint, session.userId);
    return jsonOk({ ok: true });
  } catch (e) {
    console.error('push unsubscribe', e);
    return jsonError('Kon push niet uitschakelen.', 500);
  }
}
