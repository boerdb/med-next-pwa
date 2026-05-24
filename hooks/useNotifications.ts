'use client';

import { useState, useEffect, useRef } from 'react';
import {
  getNotificationsEnabled,
  persistNotificationsEnabled,
  requestNotificationPermission,
  showMedicationNotification,
  showLowStockNotification,
} from '@/lib/notification-prefs';
import { runReminderTick, slotKey, type ReminderFlags } from '@/lib/reminder-logic';
import {
  REMINDER_FLAGS_KEY,
  syncReminderBundleToCache,
  mergeReminderFlagsFromCache,
  mergeReminderFlagRecords,
  registerPeriodicReminderSync,
  unregisterPeriodicReminderSync,
} from '@/lib/reminder-sync';
import {
  isPushConfigured,
  resyncPushSubscriptionIfNeeded,
  subscribePush,
  unsubscribePush,
} from '@/lib/push/client';
import { getPushBlockReason, pushBlockMessage } from '@/lib/pwa-capabilities';
import { medicationDaysLeft } from '@/lib/stock';
import { toLocalDateKey } from '@/lib/utils';
import type { Medication, LogEntry } from '@/lib/db/types';

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const LOW_STOCK_THRESHOLD = 7;

export function useNotifications(medications: Medication[], logs: LogEntry[]) {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [pushHint, setPushHint] = useState<string | null>(null);
  const flagsRef = useRef<ReminderFlags>({});

  useEffect(() => {
    const hydrate = async () => {
      setEnabled(getNotificationsEnabled());
      setPermission(
        typeof Notification !== 'undefined' ? Notification.permission : 'denied',
      );
      const configured = isPushConfigured();
      const block = getPushBlockReason(configured);
      setPushHint(pushBlockMessage(block));
      if (getNotificationsEnabled() && configured && !block) {
        try {
          const reg = await navigator.serviceWorker?.ready;
          const existing = reg ? await reg.pushManager.getSubscription() : null;
          if (existing) {
            await resyncPushSubscriptionIfNeeded();
          } else if (Notification.permission === 'granted') {
            await subscribePush();
          }
        } catch (e) {
          console.warn('[push] auto-register failed', e);
        }
      }
    };
    void hydrate();
    mergeReminderFlagsFromCache().then((cached) => {
      const local = parseJson<ReminderFlags>(localStorage.getItem(REMINDER_FLAGS_KEY), {});
      flagsRef.current = mergeReminderFlagRecords(local, cached);
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      const dateKey = toLocalDateKey();
      const { nextFlags, events } = runReminderTick({
        now: Date.now(),
        dateKey,
        medications,
        logs,
        flags: flagsRef.current,
      });
      flagsRef.current = nextFlags;
      localStorage.setItem(REMINDER_FLAGS_KEY, JSON.stringify(nextFlags));

      for (const ev of events) {
        const sk = slotKey(dateKey, ev.medicationId, ev.time);
        await showMedicationNotification(ev.medicationName, ev.time, ev.kind, sk);
      }

      await syncReminderBundleToCache();
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [enabled, medications, logs]);

  useEffect(() => {
    if (!enabled) return;
    const dateKey = toLocalDateKey();
    medications.forEach((med) => {
      const daysLeft = medicationDaysLeft(med);
      if (daysLeft !== null && daysLeft <= LOW_STOCK_THRESHOLD) {
        showLowStockNotification(dateKey, med.name, daysLeft);
      }
    });
  }, [enabled, medications]);

  const toggle = async () => {
    if (!enabled) {
      const configured = isPushConfigured();
      const block = getPushBlockReason(configured);
      if (block === 'denied') {
        setPushHint(pushBlockMessage(block));
        return;
      }

      const perm = await requestNotificationPermission();
      setPermission(perm);
      if (perm !== 'granted') return;

      if (configured && !block) {
        try {
          await subscribePush();
          setPushHint(null);
        } catch (e) {
          console.warn('[push] subscribe failed', e);
          setPushHint(
            'Meldingen in de app werken, maar push op de achtergrond kon niet worden geregistreerd.',
          );
        }
      } else if (block) {
        setPushHint(pushBlockMessage(block));
      }

      persistNotificationsEnabled(true);
      setEnabled(true);
      await registerPeriodicReminderSync();
    } else {
      persistNotificationsEnabled(false);
      setEnabled(false);
      setPushHint(null);
      await unsubscribePush();
      await unregisterPeriodicReminderSync();
    }
  };

  return { enabled, permission, pushHint, toggle };
}
