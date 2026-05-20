'use client';

import { useEffect, useRef } from 'react';
import type { Medication, LogEntry } from '@/lib/db/types';
import { db } from '@/lib/db/instant';
import { MEDICATIONS_KEY, LOGS_KEY } from '@/lib/reminder-sync';
import { normalizeMedication } from '@/lib/utils';

/** Mirror fresh data to localStorage so the service worker can read it. */
function mirrorToLocalStorage(medications: Medication[], logs: LogEntry[]) {
  try {
    localStorage.setItem(MEDICATIONS_KEY, JSON.stringify(medications));
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  } catch {
    // ignore quota errors
  }
}

export function useInstantData() {
  const { isLoading, error, data } = db.useQuery({
    medications: {},
    logEntries: {},
  });

  const { user } = db.useAuth();

  const medications: Medication[] = (data?.medications ?? []).map(
    (m) => normalizeMedication(m) as Medication,
  );
  const logs: LogEntry[] = (data?.logEntries ?? []) as LogEntry[];

  // Mirror to localStorage on every data update
  const mirrorRef = useRef(false);
  useEffect(() => {
    if (!isLoading && data) {
      mirrorToLocalStorage(medications, logs);
      mirrorRef.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, data]);

  return {
    isLoading,
    error: error?.message ?? null,
    medications,
    logs,
    user,
  };
}

export function useAuth() {
  const { isLoading, user, error } = db.useAuth();
  return { isLoading, user, error };
}
