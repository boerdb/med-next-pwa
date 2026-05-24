/** iPhone/iPad (incl. iPadOS met desktop UA). */
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** App opent vanaf beginscherm (vereist voor push op iOS). */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export function isSecureContextForPush(): boolean {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext;
}

export function hasPushApis(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export type PushBlockReason =
  | 'not-configured'
  | 'insecure'
  | 'no-api'
  | 'ios-not-installed'
  | 'denied'
  | null;

export function getPushBlockReason(configured: boolean): PushBlockReason {
  if (!configured) return 'not-configured';
  if (!isSecureContextForPush()) return 'insecure';
  if (!hasPushApis()) return 'no-api';
  if (isIosDevice() && !isStandalonePwa()) return 'ios-not-installed';
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    return 'denied';
  }
  return null;
}

export function pushBlockMessage(reason: PushBlockReason): string | null {
  switch (reason) {
    case 'not-configured':
      return 'Push is niet geconfigureerd op de server (VAPID-sleutels).';
    case 'insecure':
      return 'Meldingen werken alleen via HTTPS (of localhost).';
    case 'no-api':
      return 'Deze browser ondersteunt geen web push (iOS 16.4+ vereist).';
    case 'ios-not-installed':
      return 'Op iPhone/iPad: voeg MedTracker toe aan je beginscherm (deel-knop → Zet op beginscherm), open de app vandaar en zet meldingen opnieuw aan.';
    case 'denied':
      return 'Meldingen staan uit. Zet ze aan via Instellingen → Meldingen voor deze app of website.';
    default:
      return null;
  }
}
