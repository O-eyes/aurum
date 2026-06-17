import { useQuery } from "@tanstack/react-query";

// Approximate USD→GHS rate used only when the live feed is unavailable, so the
// UI always shows GH₵ (the primary, BOG-compliant currency) instead of falling
// back to raw USD. The live rate, when it loads, always takes precedence.
export const FALLBACK_GHS_PER_USD = 15;

async function fetchGhsRate(): Promise<number> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error("Exchange rate unavailable");
  const data = await res.json();
  const rate = data?.rates?.GHS;
  if (typeof rate !== "number") throw new Error("GHS rate not found");
  return rate;
}

/**
 * Always returns a usable USD→GHS rate. Prefers the live feed; falls back to a
 * documented constant so the app never displays bare USD to the user.
 */
export function useGhsRate(): number {
  const { data } = useQuery({
    queryKey: ["ghs-rate"],
    queryFn: fetchGhsRate,
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
    retry: 2,
  });
  return data ?? FALLBACK_GHS_PER_USD;
}

/** Whether the live rate has loaded (vs. the fallback). For optional UI hints. */
export function useGhsRateIsLive(): boolean {
  const { data } = useQuery({
    queryKey: ["ghs-rate"],
    queryFn: fetchGhsRate,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 2,
  });
  return typeof data === "number";
}
