'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogEntry, Medication } from '@/lib/db/types';
import { DATA_REFRESH_EVENT } from '@/lib/db/refresh';
import { MEDICATIONS_KEY, LOGS_KEY } from '@/lib/reminder-sync';
import { normalizeMedication, toLocalDateKey } from '@/lib/utils';

export type AppUser = { id: string; email: string };

/** Hoeveel dagen log-historie de app ophaalt (Geschiedenis toont er 15). */
const LOG_WINDOW_DAYS = 31;

function logsSinceDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - LOG_WINDOW_DAYS);
  return toLocalDateKey(d);
}

function mirrorToLocalStorage(medications: Medication[], logs: LogEntry[]) {
  try {
    localStorage.setItem(MEDICATIONS_KEY, JSON.stringify(medications));
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  } catch {
    // ignore quota errors
  }
}

/**
 * Laadt sessie, medicijnen en logs. Wordt één keer gebruikt in AuthProvider;
 * pagina's lezen de data via useAuth().
 */
export function useAppData() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [user, setUser] = useState<AppUser | null>(null);

  const inFlightRef = useRef(false);
  const rerunRef = useRef(false);

  const load = useCallback(async () => {
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

      const since = encodeURIComponent(logsSinceDateKey());
      const [medRes, logRes] = await Promise.all([
        fetch('/api/medications', { credentials: 'include' }),
        fetch(`/api/log-entries?since=${since}`, { credentials: 'include' }),
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

  /** Voegt gelijktijdige verzoeken samen: tijdens een lopende load volgt hooguit één extra. */
  const refresh = useCallback(async () => {
    if (inFlightRef.current) {
      rerunRef.current = true;
      return;
    }
    inFlightRef.current = true;
    try {
      do {
        rerunRef.current = false;
        await load();
      } while (rerunRef.current);
    } finally {
      inFlightRef.current = false;
    }
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void refresh();
    void refresh();
    window.addEventListener(DATA_REFRESH_EVENT, onRefresh);
    window.addEventListener('focus', onRefresh);
    return () => {
      window.removeEventListener(DATA_REFRESH_EVENT, onRefresh);
      window.removeEventListener('focus', onRefresh);
    };
  }, [refresh]);

  return {
    isLoading,
    error,
    medications,
    logs,
    user,
    refresh,
  };
}
