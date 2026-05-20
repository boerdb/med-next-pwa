'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Pill, History } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/today', label: 'Vandaag', icon: Pill },
  { href: '/manage', label: 'Beheer', icon: Calendar },
  { href: '/history', label: 'Geschiedenis', icon: History },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (pathname === '/' && href === '/today');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 flex-1 py-2 px-3 rounded-xl transition-all duration-200 min-h-[52px] justify-center',
                active
                  ? 'text-teal-600 dark:text-teal-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
              )}
            >
              <div
                className={cn(
                  'relative flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200',
                  active ? 'bg-teal-100 dark:bg-teal-900/50' : '',
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium transition-colors',
                  active ? 'font-semibold' : '',
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
