"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reserve } from "@/lib/api";
import { formatUsd, formatDate } from "@/lib/utils";
import { RefreshCw, AlertTriangle, CheckCircle2, X } from "lucide-react";

export default function ReservePage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [goldHeldOz, setGoldHeldOz] = useState("");
  const [vaultRef, setVaultRef] = useState("");
  const [formError, setFormError] = useState("");

  const { data: latest, isLoading: latestLoading } = useQuery({
    queryKey: ["reserve-latest"],
    queryFn: reserve.latest,
    refetchInterval: 60_000,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["reserve-history"],
    queryFn: reserve.history,
  });

  const snapshotMutation = useMutation({
    mutationFn: () =>
      reserve.manualSnapshot({
        goldHeldOz,
        ...(vaultRef.trim() ? { vaultReference: vaultRef.trim() } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reserve-latest"] });
      queryClient.invalidateQueries({ queryKey: ["reserve-history"] });
      setShowForm(false);
      setGoldHeldOz("");
      setVaultRef("");
      setFormError("");
    },
    onError: (e: any) => setFormError(e?.message ?? "Snapshot failed"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const oz = parseFloat(goldHeldOz);
    if (!goldHeldOz || isNaN(oz) || oz <= 0) {
      setFormError("Enter a valid gold weight in troy ounces");
      return;
    }
    snapshotMutation.mutate();
  };

  const ratio = latest ? parseFloat(latest.backingRatio) : null;
  const healthy = ratio !== null && ratio >= 0.98;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Reserve Dashboard
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 text-sm font-medium transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Take Snapshot
        </button>
      </div>

      {/* Manual snapshot form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Manual Reserve Snapshot
            </h2>
            <button
              onClick={() => {
                setShowForm(false);
                setFormError("");
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {formError && (
            <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-2.5 text-sm">
              {formError}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Gold Held (troy oz) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.00000001"
                min="0.00000001"
                placeholder="1000.000000"
                value={goldHeldOz}
                onChange={(e) => setGoldHeldOz(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Vault Reference (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Goldbod-ATT-20260611"
                value={vaultRef}
                onChange={(e) => setVaultRef(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={snapshotMutation.isPending}
                className="w-full rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium py-2 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {snapshotMutation.isPending && (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                )}
                {snapshotMutation.isPending ? "Saving…" : "Confirm Snapshot"}
              </button>
            </div>
          </form>

          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            This will record the current gold weight and automatically fetch the
            live gold price to compute the backing ratio.
          </p>
        </div>
      )}

      {/* Status banner */}
      {!latestLoading && latest && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 ${
            healthy
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
              : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700"
          }`}
        >
          {healthy ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
          )}
          <div>
            <p
              className={`font-semibold text-sm ${healthy ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}`}
            >
              {healthy
                ? "Reserve fully backed"
                : "Under-collateralization alert"}
            </p>
            <p
              className={`text-xs mt-0.5 ${healthy ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-400"}`}
            >
              Backing ratio:{" "}
              {ratio !== null ? `${(ratio * 100).toFixed(4)}%` : "—"}
              {!healthy && " — below 98% threshold"}
            </p>
          </div>
        </div>
      )}

      {/* Current snapshot stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Gold Held",
            value: latest
              ? `${parseFloat(latest.goldHeldOz).toFixed(6)} oz`
              : "—",
          },
          {
            label: "Token Supply",
            value: latest
              ? `${parseFloat(latest.tokenSupply).toFixed(4)} AUR`
              : "—",
          },
          {
            label: "Gold Price",
            value: latest ? formatUsd(latest.goldPriceUsd) + "/oz" : "—",
          },
          {
            label: "Reserve Value",
            value: latest
              ? formatUsd(
                  parseFloat(latest.goldHeldOz) *
                    parseFloat(latest.goldPriceUsd),
                )
              : "—",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {item.label}
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* History */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Snapshot History
          </h2>
        </div>
        {historyLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : !history?.length ? (
          <p className="py-8 text-center text-sm text-gray-400">
            No snapshots yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  <th className="px-6 py-3 text-left font-medium">Time</th>
                  <th className="px-6 py-3 text-left font-medium">
                    Gold Held (oz)
                  </th>
                  <th className="px-6 py-3 text-left font-medium">
                    Token Supply
                  </th>
                  <th className="px-6 py-3 text-left font-medium">
                    Gold Price
                  </th>
                  <th className="px-6 py-3 text-left font-medium">
                    Backing Ratio
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((snap) => {
                  const r = parseFloat(snap.backingRatio);
                  return (
                    <tr
                      key={snap.id}
                      className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    >
                      <td className="px-6 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(snap.snapshotedAt)}
                      </td>
                      <td className="px-6 py-3 text-gray-900 dark:text-gray-100">
                        {parseFloat(snap.goldHeldOz).toFixed(6)}
                      </td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400">
                        {parseFloat(snap.tokenSupply).toFixed(4)} AUR
                      </td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-500">
                        {formatUsd(snap.goldPriceUsd)}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`font-semibold ${r >= 0.98 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                        >
                          {(r * 100).toFixed(4)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
