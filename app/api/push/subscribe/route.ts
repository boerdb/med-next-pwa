import type { NextRequest } from 'next/server';
import { requireSession, jsonError, jsonOk } from '@/lib/api/http';
import { upsertPushSubscription } from '@/lib/push/store';
import { isPushConfigured } from '@/lib/push/web-push';
import type { PushSubscriptionJSON } from '@/lib/push/types';

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof Response) return session;

  if (!isPushConfigured()) {
    return jsonError('Push is niet geconfigureerd op de server.', 503);
  }

  try {
    const body = (await req.json()) as PushSubscriptionJSON;
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return jsonError('Ongeldige push-subscription.', 400);
    }

    await upsertPushSubscription(session.userId, {
      endpoint: body.endpoint,
      keys: body.keys,
      expirationTime: body.expirationTime ?? null,
    });

    return jsonOk({ ok: true });
  } catch (e) {
    console.error('push subscribe', e);
    return jsonError('Kon push niet registreren.', 500);
  }
}
