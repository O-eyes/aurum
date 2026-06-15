'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Sidebar } from '@/components/layout/sidebar';
import { ReserveBar } from '@/components/reserve/reserve-bar';
import { PageLoader } from '@/components/ui/spinner';
import { Menu } from 'lucide-react';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Mobile topbar with hamburger */}
        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-gold-500 flex items-center justify-center">
              <span className="text-white font-bold text-xs">Au</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white text-sm">Aurum</span>
          </div>
        </div>

        {/* Mobile: horizontal reserve strip above content */}
        <div className="lg:hidden">
          <ReserveBar orientation="horizontal" />
        </div>

        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto min-w-0">{children}</main>

          {/* Desktop: narrow reserve rail filling the height on the right */}
          <aside className="hidden lg:block w-52 shrink-0 overflow-y-auto">
            <ReserveBar orientation="vertical" />
          </aside>
        </div>
      </div>
    </div>
  );
}
