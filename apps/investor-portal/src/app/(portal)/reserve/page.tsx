'use client';

import { useQuery } from '@tanstack/react-query';
import { reserve } from '@/lib/api';
import { CUSTODIAN } from '@/lib/gold';
import { formatUsd, formatDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Building2, Clock, Coins, TrendingUp, Info } from 'lucide-react';

export default function ReservePage() {
  const { data: snapshot, isLoading } = useQuery({
    queryKey: ['reserve-snapshot'],
    queryFn: reserve.latest,
    staleTime: 55_000,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner /></div>;
  }

  const goldHeldOz   = parseFloat(snapshot?.goldHeldOz   ?? '0');
  const tokenSupply  = parseFloat(snapshot?.tokenSupply  ?? '0');
  const backingRatio = parseFloat(snapshot?.backingRatio ?? '0');
  const goldPriceUsd = parseFloat(snapshot?.goldPriceUsd ?? '0');
  const goldValueUsd = goldHeldOz * goldPriceUsd;
  const ratioPercent = (backingRatio * 100).toFixed(2);
  const isFullyBacked = backingRatio >= 1;

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Proof of Reserve</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Every AUR token is backed by physical gold held in custody. This page shows the current
          reserve position in real time.
        </p>
      </div>

      {/* ── Backing ratio hero ── */}
      <div className={`rounded-2xl p-6 ${isFullyBacked ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'}`}>
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className={`h-6 w-6 ${isFullyBacked ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
          <span className={`text-sm font-semibold uppercase tracking-wide ${isFullyBacked ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
            {isFullyBacked ? 'Fully Backed' : 'Under-Collateralised'}
          </span>
        </div>
        <p className={`text-6xl font-bold tabular-nums ${isFullyBacked ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>
          {ratioPercent}%
        </p>
        <p className={`mt-1 text-sm ${isFullyBacked ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`}>
          collateral ratio — gold held vs tokens in circulation
        </p>
        {snapshot && (
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last updated {formatDate(snapshot.snapshotedAt)}
          </p>
        )}
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            icon: TrendingUp,
            label: 'Gold Price',
            value: goldPriceUsd ? formatUsd(goldPriceUsd) + '/oz' : '—',
            sub: 'market price',
          },
          {
            icon: ShieldCheck,
            label: 'Gold in Reserve',
            value: goldHeldOz ? `${goldHeldOz.toFixed(4)} oz` : '—',
            sub: goldValueUsd ? formatUsd(goldValueUsd) : '',
          },
          {
            icon: Coins,
            label: 'AUR Circulating',
            value: tokenSupply ? `${tokenSupply.toFixed(4)}` : '—',
            sub: 'tokens outstanding',
          },
          {
            icon: Building2,
            label: 'Custodian',
            value: CUSTODIAN.name,
            sub: 'insured vault',
          },
        ].map(({ icon: Icon, label, value, sub }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500 mb-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
              {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── How it works ── */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Info className="h-4 w-4" />How Backing Works</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
          <ol className="space-y-3">
            {[
              { n: '1', t: 'Gold is purchased and deposited', d: `Physical gold is procured and deposited into ${CUSTODIAN.name}'s insured vault before any tokens are minted.` },
              { n: '2', t: 'Tokens are minted 1:1', d: 'One AUR token represents one troy ounce of gold. The smart contract only mints tokens after a reserve snapshot confirms sufficient gold coverage.' },
              { n: '3', t: 'Reserve is verified on-chain', d: 'The collateral ratio is updated each time gold is added or tokens are burned. The data on this page is pulled directly from the latest verified snapshot.' },
              { n: '4', t: 'Redemptions burn tokens', d: 'When you redeem physical gold, the corresponding AUR tokens are permanently burned, removing them from circulation and reducing the token supply.' },
            ].map(({ n, t, d }) => (
              <li key={n} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-100 dark:bg-gold-900/30 text-xs font-bold text-gold-700 dark:text-gold-400">
                  {n}
                </span>
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{t}</p>
                  <p className="mt-0.5">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* ── Custodian ── */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" />Gold Custodian</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            {[
              { label: 'Custodian', value: CUSTODIAN.name },
              { label: 'Vault address', value: CUSTODIAN.vaultAddress },
              { label: 'Pickup hours', value: CUSTODIAN.pickupHours },
              { label: 'Insurance', value: CUSTODIAN.insuranceIncluded ? 'Included on all holdings' : 'Not included' },
              { label: 'Delivery regions', value: CUSTODIAN.deliveryRegions.join(', ') },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
