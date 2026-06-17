"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { orders as ordersApi } from "@/lib/api";
import {
  LayoutDashboard,
  ShoppingCart,
  History,
  ShieldCheck,
  LogOut,
  Coins,
  Sun,
  Moon,
  X,
  Settings,
  Gem,
} from "lucide-react";

const ACTIVE_STATUSES = new Set([
  "PENDING",
  "PAYMENT_PENDING",
  "PAYMENT_CONFIRMED",
  "MINTING", // buy
  "BURN_PENDING",
  "BURN_CONFIRMED",
  "PAYOUT_PROCESSING", // sell
]);

const KYC_BADGE: Record<string, { label: string; cls: string }> = {
  APPROVED: {
    label: "Verified",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  UNDER_REVIEW: {
    label: "In Review",
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  REJECTED: {
    label: "Rejected",
    cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  NEEDS_REVIEW: {
    label: "Action needed",
    cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  PENDING: {
    label: "Unverified",
    cls: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
  },
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  const { data: orderList } = useQuery({
    queryKey: ["orders"],
    queryFn: ordersApi.list,
    staleTime: 60_000,
  });

  const pendingCount =
    orderList?.filter((o) => ACTIVE_STATUSES.has(o.status)).length ?? 0;

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Buy Gold", href: "/orders/buy", icon: ShoppingCart },
    { label: "Sell Gold", href: "/orders/sell", icon: Coins },
    { label: "Redeem Gold", href: "/orders/redeem", icon: Gem },
    {
      label: "Order History",
      href: "/orders",
      icon: History,
      badge: pendingCount,
    },
    { label: "Reserve", href: "/reserve", icon: ShieldCheck },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  const kycInfo = KYC_BADGE[user?.kycStatus ?? "PENDING"];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r w-48 shrink-0 transition-transform duration-200",
          "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700",
          open ? "translate-x-0" : "-translate-x-full",
          "md:static md:translate-x-0",
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold-500 shrink-0">
              <span className="text-white font-bold text-xs">Au</span>
            </div>
            <span className="text-base font-bold text-gray-900 dark:text-white">
              Aurum
            </span>
          </div>
          <button
            onClick={onClose}
            className="md:hidden text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isOrdersRoot = item.href === "/orders";
            const active =
              pathname === item.href ||
              (!isOrdersRoot && pathname.startsWith(item.href + "/")) ||
              (isOrdersRoot && pathname === "/orders");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-gold-50 text-gold-700 dark:bg-gold-900/20 dark:text-gold-400"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 dark:border-gray-700 p-3 space-y-1">
          <button
            onClick={toggle}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors"
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

          <div className="px-3 py-1 space-y-1">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
              {user?.firstName ?? user?.email?.split("@")[0] ?? "Investor"}
            </p>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                kycInfo.cls,
              )}
            >
              {kycInfo.label}
            </span>
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="truncate">Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
