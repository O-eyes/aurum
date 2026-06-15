'use client';

import { useQuery } from '@tanstack/react-query';
import { reserve, kyc, orders } from '@/lib/api';
import { formatUsd, formatDate } from '@/lib/utils';
import { TrendingUp, Shield, ShoppingBag, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const { data: snapshot, isLoading: snapLoading, refetch: refetchSnapshot, isFetching: snapFetching } = useQuery({
    queryKey: ['reserve-latest'],
    queryFn: reserve.latest,
    refetchInterval: 60_000,
  });

  const { data: kycQueue } = useQuery({
    queryKey: ['kyc-queue'],
    queryFn: kyc.reviewQueue,
  });

  const { data: allOrders } = useQuery({
    queryKey: ['all-orders'],
    queryFn: orders.list,
  });

  const pendingKyc = kycQueue?.filter((k) => k.status === 'UNDER_REVIEW').length ?? 0;
  const activeOrders = allOrders?.filter((o) =>
    ['PENDING', 'PAYMENT_PENDING', 'MINTING'].includes(o.status),
  ).length ?? 0;
  const ratio = snapshot ? parseFloat(snapshot.backingRatio) : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Operations Dashboard</h1>
        <p className="text-sm text-gray-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Reserve Backing Ratio"
          value={ratio !== null ? `${(ratio * 100).toFixed(2)}%` : '—'}
          sub={`Gold: ${snapshot ? parseFloat(snapshot.goldHeldOz).toFixed(4) : '—'} oz`}
          icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
          alert={ratio !== null && ratio < 0.98}
        />
        <StatCard
          title="KYC Pending Review"
          value={String(pendingKyc)}
          sub="applications awaiting decision"
          icon={<Shield className="h-5 w-5 text-yellow-500" />}
          alert={pendingKyc > 0}
        />
        <StatCard
          title="Active Orders"
          value={String(activeOrders)}
          sub="orders in progress"
          icon={<ShoppingBag className="h-5 w-5 text-purple-500" />}
        />
      </div>

      {/* Reserve snapshot */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Reserve Snapshot</h2>
            <button
              onClick={() => refetchSnapshot()}
              disabled={snapFetching}
              className="flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-600 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${snapFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <div className="px-6 py-4">
            {snapLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : snapshot ? (
              <dl className="space-y-3 text-sm">
                <Row label="Gold held" value={`${parseFloat(snapshot.goldHeldOz).toFixed(6)} oz`} />
                <Row label="Token supply" value={`${parseFloat(snapshot.tokenSupply).toFixed(4)} AUR`} />
                <Row label="Gold price" value={formatUsd(snapshot.goldPriceUsd) + '/oz'} />
                <Row
                  label="Backing ratio"
                  value={`${(parseFloat(snapshot.backingRatio) * 100).toFixed(4)}%`}
                  highlight={parseFloat(snapshot.backingRatio) < 0.98 ? 'text-red-600' : 'text-green-600'}
                />
                <Row label="Last snapshot" value={formatDate(snapshot.snapshotedAt)} />
              </dl>
            ) : (
              <p className="text-sm text-gray-400">No snapshot available</p>
            )}
          </div>
        </div>

        {/* Recent KYC */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recent KYC Submissions</h2>
            <a href="/kyc" className="text-xs text-brand-500 hover:underline">View all →</a>
          </div>
          <div className="divide-y divide-gray-50">
            {!kycQueue?.length ? (
              <p className="px-6 py-4 text-sm text-gray-400">No submissions</p>
            ) : (
              kycQueue.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {item.user.firstName ?? ''} {item.user.lastName ?? item.user.email}
                    </p>
                    <p className="text-xs text-gray-400">{item.user.email}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.status === 'UNDER_REVIEW' ? 'bg-blue-100 text-blue-800' :
                    item.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub, icon, alert }: {
  title: string; value: string; sub: string; icon: React.ReactNode; alert?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 flex items-start gap-4 ${alert ? 'border-orange-300' : 'border-gray-200'}`}>
      <div className="rounded-lg bg-gray-50 p-2">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{title}</p>
        <p className={`text-2xl font-bold ${alert ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`font-medium ${highlight ?? 'text-gray-900'}`}>{value}</dd>
    </div>
  );
}
