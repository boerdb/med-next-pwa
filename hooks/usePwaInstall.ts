'use client';

import { useState, useEffect } from 'react';

const INSTALL_DISMISS_KEY = 'medtracker:installDismissed';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
}

function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

function isDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const ts = Number(localStorage.getItem(INSTALL_DISMISS_KEY) ?? '0');
  return Date.now() - ts < DISMISS_DURATION_MS;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode() || isDismissed()) return;

    // iOS — show manual guide
    if (isIos()) {
      // Use setTimeout to avoid synchronous setState in effect body
      setTimeout(() => setShowIos(true), 0);
      return;
    }

    // Android/Chrome — intercept native prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowAndroid(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setShowAndroid(false);
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    setShowAndroid(false);
    setShowIos(false);
  };

  return { showAndroid, showIos, install, dismiss };
}
