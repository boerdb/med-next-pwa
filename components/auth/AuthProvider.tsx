'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext } from 'react';
import { useAppData, type AppUser } from '@/hooks/useAppData';
import { LoginDialog } from './LoginDialog';

type AuthContextValue = ReturnType<typeof useAppData>;

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAppData();
  const pathname = usePathname();

  const isSplash = pathname === '/';
  // Offline met gecachte gegevens: geen inlogscherm tonen.
  const needsAuth = !isSplash && !auth.isLoading && !auth.user && !auth.isOffline;

  return (
    <AuthContext.Provider value={auth}>
      {children}
      {needsAuth && <LoginDialog />}
    </AuthContext.Provider>
  );
}

export type { AppUser };
