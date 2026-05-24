'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogEntry, Medication } from '@/lib/db/types';
import { DATA_REFRESH_EVENT } from '@/lib/db/refresh';
import { MEDICATIONS_KEY, LOGS_KEY } from '@/lib/reminder-sync';
import { normalizeMedication } from '@/lib/utils';

export type AppUser = { id: string; email: string };

function mirrorToLocalStorage(medications: Medication[], logs: LogEntry[]) {
  try {
    localStorage.setItem(MEDICATIONS_KEY, JSON.stringify(medications));
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  } catch {
    // ignore quota errors
  }
}

export function useAppData() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [user, setUser] = useState<AppUser | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const meRes = await fetch('/api/auth/me', { credentials: 'include' });
      if (!meRes.ok) throw new Error('Kon sessie niet laden.');
      const meData = (await meRes.json()) as { user: AppUser | null };
      setUser(meData.user);

      if (!meData.user) {
        setMedications([]);
        setLogs([]);
        mirrorToLocalStorage([], []);
        return;
      }

      const [medRes, logRes] = await Promise.all([
        fetch('/api/medications', { credentials: 'include' }),
        fetch('/api/log-entries', { credentials: 'include' }),
      ]);

      if (!medRes.ok || !logRes.ok) {
        throw new Error('Kon gegevens niet laden.');
      }

      const medData = (await medRes.json()) as { medications: Medication[] };
      const logData = (await logRes.json()) as { logEntries: LogEntry[] };

      const meds = medData.medications.map((m) =>
        normalizeMedication(m) as Medication,
      );
      setMedications(meds);
      setLogs(logData.logEntries);
      mirrorToLocalStorage(meds, logData.logEntries);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden mislukt.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    void refreshRef.current();
    const onRefresh = () => void refreshRef.current();
    const onFocus = () => void refreshRef.current();
    window.addEventListener(DATA_REFRESH_EVENT, onRefresh);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener(DATA_REFRESH_EVENT, onRefresh);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return {
    isLoading,
    error,
    medications,
    logs,
    user,
    refresh,
  };
}
