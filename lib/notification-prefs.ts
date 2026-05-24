export const NOTIFICATIONS_ENABLED_KEY = 'medtracker:notificationsEnabled';

export function getNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === '1';
}

export function persistNotificationsEnabled(value: boolean): void {
  localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, value ? '1' : '0');
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return Notification.requestPermission();
}

const slotTagForNotify = (sk: string) =>
  sk.replace(/::/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');

const SW_READY_MS = 2500;

async function registrationWhenReady(): Promise<ServiceWorkerRegistration | null> {
  const sw = navigator.serviceWorker;
  if (!sw) return null;
  try {
    return await Promise.race([
      sw.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), SW_READY_MS)),
    ]);
  } catch {
    return null;
  }
}

export async function showMedicationNotification(
  medicationName: string,
  time: string,
  stage: 'first' | 'second',
  sk: string,
): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const title = stage === 'first' ? 'Medicijn innemen' : 'Nog niet geregistreerd';
  const body =
    stage === 'first'
      ? `${medicationName} — ${time}. Tik in de app op Innemen.`
      : `${medicationName} (${time}): nog niet als ingenomen gemarkeerd. Open de app en tik op Innemen.`;

  const tag = `mt-${slotTagForNotify(sk)}-${stage}`;
  const icon = '/icons/icon-192x192.png';
  const badge = '/icons/icon-192x192.png';

  try {
    const reg = await registrationWhenReady();
    if (reg && 'showNotification' in reg) {
      await reg.showNotification(title, {
        body,
        icon,
        badge,
        tag,
        vibrate: stage === 'first' ? [160] : [180, 100, 180],
      } as NotificationOptions);
      return;
    }
  } catch {
    // fall through
  }

  try {
    new Notification(title, { body, icon });
  } catch {
    // ignore
  }
}

const LOW_STOCK_ALERTS_KEY = 'medtracker:lowStockAlerts';

export async function showLowStockNotification(
  dateKey: string,
  medicationName: string,
  daysLeft: number,
): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const alertKey = `${dateKey}::lowstock::${medicationName}`;
  const fired = JSON.parse(localStorage.getItem(LOW_STOCK_ALERTS_KEY) ?? '{}') as Record<string, boolean>;
  if (fired[alertKey]) return;

  fired[alertKey] = true;
  localStorage.setItem(LOW_STOCK_ALERTS_KEY, JSON.stringify(fired));

  const title = 'Lage voorraad';
  const body = `${medicationName} heeft nog ${daysLeft} dag${daysLeft === 1 ? '' : 'en'} voorraad.`;

  try {
    const reg = await registrationWhenReady();
    if (reg && 'showNotification' in reg) {
      await reg.showNotification(title, { body, icon: '/icons/icon-192x192.png', tag: `lowstock-${medicationName}` });
      return;
    }
  } catch {
    // fall through
  }

  try {
    new Notification(title, { body });
  } catch {
    // ignore
  }
}
