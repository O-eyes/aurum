'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import {
  LayoutDashboard, Shield, ShoppingBag, ScrollText,
  Users, TrendingUp, LogOut, Sun, Moon, X, Settings,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'KYC Review', href: '/kyc', icon: Shield },
  { label: 'Orders', href: '/orders', icon: ShoppingBag },
  { label: 'Reserve', href: '/reserve', icon: TrendingUp },
  { label: 'Audit Log', href: '/audit', icon: ScrollText },
  { label: 'Users', href: '/users', icon: Users },
  { label: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps { open: boolean; onClose: () => void; }

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r w-44 shrink-0 transition-transform duration-200',
        'bg-gray-900 dark:bg-gray-950 border-gray-700 dark:border-gray-800',
        open ? 'translate-x-0' : '-translate-x-full',
        'md:static md:translate-x-0',
      )}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-brand-500 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">Au</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-none">Aurum</p>
              <p className="text-xs text-gray-500 leading-none mt-0.5">Ops</p>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden text-gray-500 hover:text-gray-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-700 dark:border-gray-800 p-3 space-y-1">
          <button
            onClick={toggle}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            <span className="truncate">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <div className="px-3 py-1">
            <p className="text-xs font-medium text-gray-300 truncate">
              {user?.firstName ?? user?.email?.split('@')[0]}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.roles?.join(', ')}</p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut className="h-3 w-3 shrink-0" />
            <span className="truncate">Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
