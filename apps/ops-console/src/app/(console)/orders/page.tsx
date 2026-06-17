"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orders as ordersApi } from "@/lib/api";
import { formatUsd, formatDate, ORDER_STATUS_COLORS } from "@/lib/utils";
import { Select, type SelectOption } from "@/components/ui/select";

const STATUS_FILTERS = [
  "ALL",
  "PENDING",
  "PAYMENT_PENDING",
  "PAYMENT_CONFIRMED",
  "MINTING",
  "COMPLETED",
  "FAILED",
  "COMPLIANCE_HOLD",
];

const TYPE_OPTIONS: SelectOption[] = [
  { value: "ALL", label: "All types" },
  { value: "BUY", label: "BUY" },
  { value: "SELL", label: "SELL" },
];

const STATUS_OPTIONS: SelectOption[] = STATUS_FILTERS.map((s) => ({
  value: s,
  label: s === "ALL" ? "All statuses" : s,
}));

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["all-orders"],
    queryFn: ordersApi.list,
    refetchInterval: 30_000,
  });

  const filtered = (data ?? []).filter((o) => {
    if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
    if (typeFilter !== "ALL" && o.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.id.includes(q) ||
        o.walletAddress.toLowerCase().includes(q) ||
        o.userId?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">All Orders</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by order ID or wallet…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-64"
        />
        <Select
          options={TYPE_OPTIONS}
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as typeof typeFilter)}
          className="w-36"
        />
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
          className="w-52"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : !filtered.length ? (
          <p className="py-10 text-center text-sm text-gray-400">
            No orders match the current filters
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="px-4 py-3 text-left font-medium">Order ID</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Tokens</th>
                  <th className="px-4 py-3 text-left font-medium">Wallet</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {order.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${order.type === "BUY" ? "text-green-600" : "text-red-600"}`}
                      >
                        {order.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatUsd(order.amountUsd)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {parseFloat(order.tokenAmount).toFixed(4)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {order.walletAddress.slice(0, 10)}…
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatDate(order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Showing {filtered.length} of {data?.length ?? 0} orders
      </p>
    </div>
  );
}
