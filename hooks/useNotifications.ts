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
  hasActivePushSubscription,
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

type UseNotificationsOptions = {
  /** Wacht tot medicijnen + logs geladen zijn (voorkomt valse meldingen). */
  dataReady?: boolean;
};

async function fetchServerReminderFlags(dateKey: string): Promise<ReminderFlags | null> {
  try {
    const res = await fetch(`/api/push/reminder-flags?dateKey=${encodeURIComponent(dateKey)}`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { flags?: ReminderFlags };
    return data.flags ?? null;
  } catch {
    return null;
  }
}

async function loadMergedReminderFlags(dateKey: string): Promise<ReminderFlags> {
  const local = parseJson<ReminderFlags>(localStorage.getItem(REMINDER_FLAGS_KEY), {});
  const cached = await mergeReminderFlagsFromCache();
  const server = await fetchServerReminderFlags(dateKey);
  return mergeReminderFlagRecords(mergeReminderFlagRecords(local, cached), server);
}

export function useNotifications(
  medications: Medication[],
  logs: LogEntry[],
  options: UseNotificationsOptions = {},
) {
  const { dataReady = true } = options;
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [pushHint, setPushHint] = useState<string | null>(null);
  const [flagsReady, setFlagsReady] = useState(false);
  const flagsRef = useRef<ReminderFlags>({});
  /** Server push stuurt meldingen; geen dubbele popups in de geopende app. */
  const serverPushActiveRef = useRef(false);

  useEffect(() => {
    const hydrate = async () => {
      const dateKey = toLocalDateKey();
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

      serverPushActiveRef.current =
        getNotificationsEnabled() && configured && !block && (await hasActivePushSubscription());

      const merged = await loadMergedReminderFlags(dateKey);
      flagsRef.current = merged;
      localStorage.setItem(REMINDER_FLAGS_KEY, JSON.stringify(merged));
      setFlagsReady(true);
    };
    void hydrate();
  }, []);

  // Herlaad server-flags zodra data binnen is (na lege start-state).
  useEffect(() => {
    if (!enabled || !dataReady || !flagsReady) return;
    const dateKey = toLocalDateKey();
    void loadMergedReminderFlags(dateKey).then((merged) => {
      flagsRef.current = merged;
      localStorage.setItem(REMINDER_FLAGS_KEY, JSON.stringify(merged));
    });
  }, [enabled, dataReady, flagsReady, logs.length, medications.length]);

  useEffect(() => {
    if (!enabled || !dataReady || !flagsReady) return;

    const syncBundle = () => void syncReminderBundleToCache();

    if (serverPushActiveRef.current) {
      syncBundle();
      return;
    }

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
  }, [enabled, dataReady, flagsReady, medications, logs]);

  useEffect(() => {
    if (!enabled || !dataReady) return;
    const dateKey = toLocalDateKey();
    medications.forEach((med) => {
      const daysLeft = medicationDaysLeft(med);
      if (daysLeft !== null && daysLeft <= LOW_STOCK_THRESHOLD) {
        showLowStockNotification(dateKey, med.name, daysLeft);
      }
    });
  }, [enabled, dataReady, medications]);

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
          serverPushActiveRef.current = true;
        } catch (e) {
          console.warn('[push] subscribe failed', e);
          serverPushActiveRef.current = false;
          setPushHint(
            'Meldingen in de app werken, maar push op de achtergrond kon niet worden geregistreerd.',
          );
        }
      } else if (block) {
        setPushHint(pushBlockMessage(block));
        serverPushActiveRef.current = false;
      }

      persistNotificationsEnabled(true);
      setEnabled(true);
      await registerPeriodicReminderSync();
    } else {
      persistNotificationsEnabled(false);
      setEnabled(false);
      setPushHint(null);
      serverPushActiveRef.current = false;
      await unsubscribePush();
      await unregisterPeriodicReminderSync();
    }
  };

  return { enabled, permission, pushHint, toggle };
}
