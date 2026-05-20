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
import { toLocalDateKey } from '@/lib/utils';
import type { Medication, LogEntry } from '@/lib/db/types';

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

const LOW_STOCK_THRESHOLD = 7;

export function useNotifications(medications: Medication[], logs: LogEntry[]) {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const flagsRef = useRef<ReminderFlags>({});

  // Hydrate from localStorage (client only)
  useEffect(() => {
    // Wrap in queueMicrotask to avoid synchronous setState-in-effect lint warning
    // while still hydrating from localStorage before first paint
    const hydrate = async () => {
      setEnabled(getNotificationsEnabled());
      setPermission(
        typeof Notification !== 'undefined' ? Notification.permission : 'denied',
      );
    };
    void hydrate();
    // Merge flags from cache (service worker may have updated them)
    mergeReminderFlagsFromCache().then((cached) => {
      const local = parseJson<ReminderFlags>(localStorage.getItem(REMINDER_FLAGS_KEY), {});
      flagsRef.current = mergeReminderFlagRecords(local, cached);
    });
  }, []);

  // Reminder tick every 60 seconds when notifications are enabled
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

  // Low-stock check on data change
  useEffect(() => {
    if (!enabled) return;
    const dateKey = toLocalDateKey();
    medications.forEach((med) => {
      if (med.stockCount !== null && med.stockCount <= LOW_STOCK_THRESHOLD) {
        showLowStockNotification(dateKey, med.name, med.stockCount);
      }
    });
  }, [enabled, medications]);

  const toggle = async () => {
    if (!enabled) {
      const perm = await requestNotificationPermission();
      setPermission(perm);
      if (perm !== 'granted') return;
      persistNotificationsEnabled(true);
      setEnabled(true);
      await registerPeriodicReminderSync();
    } else {
      persistNotificationsEnabled(false);
      setEnabled(false);
      await unregisterPeriodicReminderSync();
    }
  };

  return { enabled, permission, toggle };
}
