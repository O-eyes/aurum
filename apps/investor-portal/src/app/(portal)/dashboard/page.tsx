'use client';

import { useQuery } from '@tanstack/react-query';
import { users, orders, reserve } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert } from '@/components/ui/alert';
import { formatUsd, formatOz, formatDate, formatGhs, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/utils';
import { useGhsRate } from '@/hooks/useGhsRate';
import Link from 'next/link';
import { TrendingUp, Coins, DollarSign, ShieldCheck, ArrowRight } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['balance'],
    queryFn: users.balance,
    refetchInterval: 60_000,
  });

  const { data: recentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: orders.list,
  });

  const { data: snapshot } = useQuery({
    queryKey: ['reserve-snapshot'],
    queryFn: reserve.latest,
    staleTime: 300_000,
  });

  const ghsRate = useGhsRate();
  const kycApproved = user?.kycStatus === 'APPROVED';

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>

      {/* KYC banner */}
      {!kycApproved && (
        <Alert variant="warning" title="Identity verification required">
          Complete KYC to unlock buying and selling gold tokens.{' '}
          <Link href="/kyc" className="font-medium underline">
            Verify now →
          </Link>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Token Balance"
          value={balanceLoading ? null : `${parseFloat(balance?.balance ?? '0').toFixed(4)} AUR`}
          sub="Gold tokens held"
          icon={<Coins className="h-5 w-5 text-gold-500" />}
        />
        <StatCard
          title="Portfolio Value"
          value={balanceLoading ? null : ghsRate ? formatGhs(balance?.balanceUsd ?? '0', ghsRate) : formatUsd(balance?.balanceUsd ?? '0')}
          sub={ghsRate ? `≈ ${formatUsd(balance?.balanceUsd ?? '0')} · Gold: ${formatUsd(balance?.goldPriceUsd ?? '0')}/oz` : `Gold price: ${formatUsd(balance?.goldPriceUsd ?? '0')}/oz`}
          icon={<DollarSign className="h-5 w-5 text-green-500" />}
        />
        <StatCard
          title="Reserve Ratio"
          value={snapshot ? `${(parseFloat(snapshot.backingRatio) * 100).toFixed(2)}%` : '—'}
          sub="Gold backing"
          icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
          highlight={
            snapshot && parseFloat(snapshot.backingRatio) >= 0.98
              ? 'text-green-600'
              : 'text-red-600'
          }
        />
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/orders/buy"
              className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors px-4 py-2 text-sm bg-gold-500 hover:bg-gold-600 text-white"
            >
              Buy Gold Tokens
            </Link>
            <Link
              href="/orders/sell"
              className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors px-4 py-2 text-sm border border-gold-500 text-gold-600 hover:bg-gold-50"
            >
              Sell Tokens
            </Link>
            {!kycApproved && (
              <Link
                href="/kyc"
                className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors px-4 py-2 text-sm bg-white hover:bg-gray-50 text-gray-900 border border-gray-300"
              >
                <ShieldCheck className="h-4 w-4" />
                Complete KYC
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent orders */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent Orders</CardTitle>
          <Link
            href="/orders"
            className="flex items-center gap-1 text-sm text-gold-600 hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {ordersLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : !recentOrders?.length ? (
            <p className="py-8 text-center text-sm text-gray-500">No orders yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="px-6 py-3 text-left font-medium">Type</th>
                  <th className="px-6 py-3 text-left font-medium">Amount</th>
                  <th className="px-6 py-3 text-left font-medium">Tokens</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.slice(0, 5).map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <span
                        className={`font-medium ${
                          order.type === 'BUY' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {order.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-900">
                      {ghsRate ? formatGhs(order.amountUsd, ghsRate) : formatUsd(order.amountUsd)}
                      <p className="text-xs text-gray-400 mt-0.5">{formatUsd(order.amountUsd)}</p>
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {parseFloat(order.tokenAmount).toFixed(4)} AUR
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-500">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon,
  highlight,
}: {
  title: string;
  value: string | null;
  sub: string;
  icon: React.ReactNode;
  highlight?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 pt-5">
        <div className="rounded-lg bg-gray-50 p-2">{icon}</div>
        <div>
          <p className="text-xs text-gray-500 font-medium">{title}</p>
          {value === null ? (
            <Spinner className="h-4 w-4 mt-1" />
          ) : (
            <p className={`text-xl font-bold text-gray-900 ${highlight ?? ''}`}>{value}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}
