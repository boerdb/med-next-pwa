import {
  bundledReminderBody,
  bundledReminderTag,
  bundledReminderTitle,
  bundledReminderVibrate,
  type BundledReminderEvent,
} from '@/lib/reminder-bundle';

export function bundledReminderToPushPayload(bundle: BundledReminderEvent) {
  const stage = bundle.kind;
  return {
    title: bundledReminderTitle(stage),
    body: bundledReminderBody(bundle),
    url: '/today',
    tag: bundledReminderTag(bundle.dateKey, bundle.time, stage),
    vibrate: bundledReminderVibrate(stage),
  };
}
