"use client";

import { useAuth } from "@/contexts/auth-context";
import { KYC_STATUS_LABELS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";

const kycVariants: Record<
  string,
  "success" | "warning" | "danger" | "info" | "default"
> = {
  APPROVED: "success",
  UNDER_REVIEW: "info",
  REJECTED: "danger",
  NEEDS_REVIEW: "warning",
  PENDING: "default",
};

export function Header({ title }: { title: string }) {
  const { user } = useAuth();
  const kycStatus = user?.kycStatus ?? "PENDING";

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-4">
        <Badge variant={kycVariants[kycStatus] ?? "default"}>
          KYC: {KYC_STATUS_LABELS[kycStatus] ?? kycStatus}
        </Badge>
        <button className="rounded-lg p-2 hover:bg-gray-100 transition-colors">
          <Bell className="h-4 w-4 text-gray-500" />
        </button>
      </div>
    </header>
  );
}
