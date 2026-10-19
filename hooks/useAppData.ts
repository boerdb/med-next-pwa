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

const USER_KEY = 'medtracker:user';

function mirrorToLocalStorage(
  user: AppUser | null,
  medications: Medication[],
  logs: LogEntry[],
) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
    localStorage.setItem(MEDICATIONS_KEY, JSON.stringify(medications));
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  } catch {
    // ignore quota errors
  }
}

/** Laatst opgeslagen gegevens, voor gebruik zonder verbinding. */
function readCachedData(): {
  user: AppUser;
  medications: Medication[];
  logs: LogEntry[];
} | null {
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as AppUser | null;
    if (!user) return null;
    const medications = JSON.parse(localStorage.getItem(MEDICATIONS_KEY) ?? '[]') as Medication[];
    const logs = JSON.parse(localStorage.getItem(LOGS_KEY) ?? '[]') as LogEntry[];
    return { user, medications: medications.map((m) => normalizeMedication(m) as Medication), logs };
  } catch {
    return null;
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
  const [isOffline, setIsOffline] = useState(false);

  const inFlightRef = useRef(false);
  const rerunRef = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    let meRes: Response;
    try {
      meRes = await fetch('/api/auth/me', { credentials: 'include' });
    } catch {
      // Geen verbinding: toon de laatst opgeslagen gegevens.
      const cached = readCachedData();
      if (cached) {
        setUser(cached.user);
        setMedications(cached.medications);
        setLogs(cached.logs);
        setIsOffline(true);
        setError('Geen verbinding — je ziet de laatst opgeslagen gegevens.');
      } else {
        setError('Geen verbinding. Probeer het later opnieuw.');
      }
      setIsLoading(false);
      return;
    }
    setIsOffline(false);
    try {
      if (!meRes.ok) throw new Error('Kon sessie niet laden.');
      const meData = (await meRes.json()) as { user: AppUser | null };
      setUser(meData.user);

      if (!meData.user) {
        setMedications([]);
        setLogs([]);
        mirrorToLocalStorage(null, [], []);
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
      mirrorToLocalStorage(meData.user, meds, logData.logEntries);
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
    window.addEventListener('online', onRefresh);
    return () => {
      window.removeEventListener('online', onRefresh);
      window.removeEventListener(DATA_REFRESH_EVENT, onRefresh);
      window.removeEventListener('focus', onRefresh);
    };
  }, [refresh]);

  /** Lokale update vóór de server antwoordt (optimistische UI). */
  const patchLogs = useCallback((update: (logs: LogEntry[]) => LogEntry[]) => {
    setLogs(update);
  }, []);

  return {
    isLoading,
    isOffline,
    error,
    medications,
    logs,
    user,
    refresh,
    patchLogs,
  };
}
