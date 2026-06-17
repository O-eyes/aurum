"use client";

import { useQuery } from "@tanstack/react-query";
import { reserve } from "@/lib/api";
import { formatUsd } from "@/lib/utils";
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

// Dev mock so the bar renders without a live backend
const DEV_SNAPSHOT = {
  backingRatio: "1.0000",
  goldHeldOz: "1250.000000",
  tokenSupply: "1250.0000",
  goldPriceUsd: "2648.50",
  snapshotedAt: new Date().toISOString(),
};

function useSecondsSince(isoTimestamp: string | undefined) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!isoTimestamp) return;
    const tick = () =>
      setSeconds(
        Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000),
      );
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [isoTimestamp]);
  return seconds;
}

function formatAgo(s: number) {
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function ReserveBar({
  orientation = "horizontal",
}: {
  orientation?: "horizontal" | "vertical";
}) {
  const isDev = process.env.NODE_ENV === "development";
  const vertical = orientation === "vertical";

  const { data: liveData } = useQuery({
    queryKey: ["reserve-snapshot"],
    queryFn: reserve.latest,
    staleTime: 55_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const data = liveData ?? (isDev ? DEV_SNAPSHOT : null);
  const isLive = !!liveData;
  const secondsSince = useSecondsSince(data?.snapshotedAt);

  if (!data) {
    return (
      <div
        className={`${vertical ? "flex flex-col gap-4 h-full px-4 py-5" : "flex items-center gap-4 border-b px-6 py-3"} border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900`}
      >
        {[160, 120, 140, 110].map((w) => (
          <div
            key={w}
            className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
            style={{ width: vertical ? "100%" : w }}
          />
        ))}
      </div>
    );
  }

  const ratio = parseFloat(data.backingRatio);
  const ratioPercent = (ratio * 100).toFixed(2);
  const reserveValue =
    parseFloat(data.goldHeldOz) * parseFloat(data.goldPriceUsd);
  const tokenSupply = parseFloat(data.tokenSupply);

  const { textColor, bgColor, borderColor, Icon, statusLabel } =
    ratio >= 1.0
      ? {
          textColor: "text-emerald-700 dark:text-emerald-400",
          bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
          borderColor: "border-emerald-200 dark:border-emerald-800",
          Icon: ShieldCheck,
          statusLabel: "Fully Backed",
        }
      : ratio >= 0.98
        ? {
            textColor: "text-yellow-700 dark:text-yellow-400",
            bgColor: "bg-yellow-50 dark:bg-yellow-950/40",
            borderColor: "border-yellow-200 dark:border-yellow-800",
            Icon: ShieldAlert,
            statusLabel: "Near Threshold",
          }
        : {
            textColor: "text-red-700 dark:text-red-400",
            bgColor: "bg-red-50 dark:bg-red-950/40",
            borderColor: "border-red-200 dark:border-red-800",
            Icon: ShieldX,
            statusLabel: "Under-collateralised",
          };

  const liveIndicator =
    isDev && !isLive ? (
      <span className="text-xs text-gray-400 dark:text-gray-500 italic">
        dev preview
      </span>
    ) : (
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {secondsSince === 0 ? "live" : `updated ${formatAgo(secondsSince)}`}
        </span>
      </span>
    );

  // ── Vertical rail (narrow, fills height) ────────────────────────────────────
  if (vertical) {
    return (
      <div
        className={`flex h-full flex-col border-l ${borderColor} ${bgColor}`}
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200/60 dark:border-gray-700/60">
          <Icon className={`h-5 w-5 ${textColor} shrink-0`} />
          <div>
            <p className={`text-lg font-bold leading-none ${textColor}`}>
              {ratioPercent}%
            </p>
            <p className={`text-xs font-medium ${textColor} opacity-75 mt-0.5`}>
              {statusLabel}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5 px-4 py-5 flex-1">
          <Metric
            label="Reserve Value"
            value={formatUsd(reserveValue, 0)}
            sub={`${parseFloat(data.goldHeldOz).toFixed(2)} oz`}
            isDev={isDev && !isLive}
          />
          <Metric
            label="Token Supply"
            value={`${tokenSupply.toLocaleString("en-US", { maximumFractionDigits: 2 })} AUR`}
            sub="1 AUR = 1 oz gold"
            isDev={isDev && !isLive}
          />
          <Metric
            label="Gold Price"
            value={`${formatUsd(data.goldPriceUsd)}/oz`}
            sub="spot"
            isDev={isDev && !isLive}
          />
        </div>

        <div className="px-4 py-3 border-t border-gray-200/60 dark:border-gray-700/60">
          {liveIndicator}
        </div>
      </div>
    );
  }

  // ── Horizontal bar (mobile / top) ───────────────────────────────────────────
  return (
    <div
      className={`flex items-center gap-4 border-b ${borderColor} ${bgColor} px-4 py-2.5 flex-wrap`}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <Icon className={`h-4 w-4 ${textColor}`} />
        <span className={`text-sm font-bold ${textColor}`}>
          {ratioPercent}%
        </span>
        <span
          className={`hidden sm:inline text-xs font-medium ${textColor} opacity-75`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="hidden sm:block h-4 w-px bg-gray-300 dark:bg-gray-600 shrink-0" />

      <div className="flex items-center gap-4 flex-1 flex-wrap min-w-0">
        <Metric
          label="Reserve Value"
          value={formatUsd(reserveValue, 0)}
          sub={`${parseFloat(data.goldHeldOz).toFixed(2)} oz`}
          isDev={isDev && !isLive}
        />
        <div className="hidden md:block h-4 w-px bg-gray-300 dark:bg-gray-600 shrink-0" />
        <Metric
          label="Token Supply"
          value={`${tokenSupply.toLocaleString("en-US", { maximumFractionDigits: 2 })} AUR`}
          sub="1 AUR = 1 oz gold"
          isDev={isDev && !isLive}
        />
        <div className="hidden md:block h-4 w-px bg-gray-300 dark:bg-gray-600 shrink-0" />
        <Metric
          label="Gold Price"
          value={`${formatUsd(data.goldPriceUsd)}/oz`}
          sub="spot"
          isDev={isDev && !isLive}
        />
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        {liveIndicator}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  isDev,
}: {
  label: string;
  value: string;
  sub: string;
  isDev: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-none">
        {label}
      </p>
      <p
        className={`text-sm font-semibold leading-tight mt-0.5 truncate ${isDev ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100"}`}
      >
        {value}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 leading-none mt-0.5">
        {sub}
      </p>
    </div>
  );
}
