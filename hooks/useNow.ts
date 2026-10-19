'use client';

import { useEffect, useState } from 'react';

/** Huidige tijd, elke `intervalMs` bijgewerkt (ook nodig om na middernacht om te schakelen). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
