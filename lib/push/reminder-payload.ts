import type { ReminderEvent } from '@/lib/reminder-logic';

const slotTagForNotify = (sk: string) =>
  sk.replace(/::/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');

export function reminderEventToPushPayload(ev: ReminderEvent, slotKeyStr: string) {
  const stage = ev.kind;
  const title = stage === 'first' ? 'Medicijn innemen' : 'Nog niet geregistreerd';
  const body =
    stage === 'first'
      ? `${ev.medicationName} — ${ev.time}. Tik in de app op Innemen.`
      : `${ev.medicationName} (${ev.time}): nog niet als ingenomen gemarkeerd. Open de app en tik op Innemen.`;

  return {
    title,
    body,
    url: '/today',
    tag: `mt-${slotTagForNotify(slotKeyStr)}-${stage}`,
    vibrate: stage === 'first' ? [160] : [180, 100, 180],
  };
}
