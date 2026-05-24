/** Server/cron timezone — medicatietijden zijn bedoeld in Nederlandse lokale tijd. */
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'Europe/Amsterdam';

/** YYYY-MM-DD in a given IANA timezone. */
export function toDateKeyInTimeZone(
  date: Date = new Date(),
  timeZone: string = APP_TIMEZONE,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function wallPartsInTimeZone(ts: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ts));

  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
  };
}

/** UTC ms for a wall-clock date/time in an IANA timezone. */
export function parseScheduleMsInTimeZone(
  dateKey: string,
  timeHHMM: string,
  timeZone: string = APP_TIMEZONE,
): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = timeHHMM.split(':').map(Number);

  let ts = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 4; i++) {
    const p = wallPartsInTimeZone(ts, timeZone);
    const desired = Date.UTC(year, month - 1, day, hour, minute);
    const actual = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    ts += desired - actual;
  }
  return ts;
}
