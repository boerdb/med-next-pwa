import webpush from 'web-push';
import type { PushSubscriptionJSON } from './types';

export function configureWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() ?? 'mailto:med@clvs.nl';

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim(),
  );
}

export type MedicationPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  vibrate?: number[];
};

export async function sendMedicationPush(
  sub: PushSubscriptionJSON,
  payload: MedicationPushPayload,
): Promise<{ ok: boolean; statusCode?: number }> {
  if (!configureWebPush()) return { ok: false };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/today',
    tag: payload.tag ?? 'medtracker-reminder',
    vibrate: payload.vibrate,
  });

  try {
    await webpush.sendNotification(sub, body);
    return { ok: true };
  } catch (err: unknown) {
    const statusCode =
      typeof err === 'object' && err !== null && 'statusCode' in err
        ? Number((err as { statusCode: number }).statusCode)
        : undefined;
    return { ok: false, statusCode };
  }
}
