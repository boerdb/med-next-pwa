import type { ReminderEvent } from '@/lib/reminder-logic';

const slotTagForNotify = (sk: string) =>
  sk.replace(/::/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');

export function reminderEventToPushPayload(ev: ReminderEvent, slotKeyStr: string) {
  const stage = ev.kind;
  const title = stage === 'first' ? 'Medicijn innemen' : 'Medicijn nog niet ingenomen';
  const body =
    stage === 'first'
      ? `${ev.medicationName} — ${ev.time}. Open de app om te registreren.`
      : `${ev.medicationName} om ${ev.time} — nog steeds niet geregistreerd na 5 minuten.`;

  return {
    title,
    body,
    url: '/today',
    tag: `mt-${slotTagForNotify(slotKeyStr)}-${stage}`,
    vibrate: stage === 'first' ? [160] : [180, 100, 180],
  };
}
