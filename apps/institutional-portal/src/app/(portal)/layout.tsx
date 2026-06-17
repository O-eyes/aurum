"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import {
  LayoutDashboard,
  ShoppingBag,
  BarChart3,
  LogOut,
  Sun,
  Moon,
  X,
  Menu,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Orders", href: "/orders", icon: ShoppingBag },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
      </div>
    );
  if (!isAuthenticated) return null;

  const Sidebar = () => (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r w-44 shrink-0 transition-transform duration-200",
          "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "md:static md:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-gold-500 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">Au</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white leading-none">
                Aurum
              </p>
              <p className="text-xs text-gray-400 leading-none mt-0.5">
                Institutional
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-gold-50 text-gold-700 dark:bg-gold-900/20 dark:text-gold-400"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 dark:border-gray-700 p-3 space-y-1">
          <button
            onClick={toggle}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 shrink-0" />
            ) : (
              <Moon className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate">
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          </button>
          <p className="px-3 text-xs text-gray-400 dark:text-gray-500 truncate">
            {user?.email}
          </p>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="truncate">Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Mobile topbar */}
        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-gold-500 flex items-center justify-center">
              <span className="text-white font-bold text-xs">Au</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Institutional
            </span>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
