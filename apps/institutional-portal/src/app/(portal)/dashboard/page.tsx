'use client';

import { useQuery } from '@tanstack/react-query';
import { users, orders as ordersApi } from '@/lib/api';
import { formatUsd, formatDate, ORDER_STATUS_COLORS } from '@/lib/utils';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Coins, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: balance } = useQuery({ queryKey: ['balance'], queryFn: users.balance, refetchInterval: 60_000 });
  const { data: orderList, isLoading } = useQuery({ queryKey: ['orders'], queryFn: ordersApi.list });

  const totalOrders = orderList?.length ?? 0;
  const completedOrders = orderList?.filter((o) => o.status === 'COMPLETED').length ?? 0;
  const totalVolume = orderList
    ?.filter((o) => o.status === 'COMPLETED')
    .reduce((sum, o) => sum + parseFloat(o.amountUsd), 0) ?? 0;

  const kycApproved = user?.kycStatus === 'APPROVED';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Institutional Dashboard</h1>
        <p className="text-sm text-gray-400">{user?.email}</p>
      </div>

      {!kycApproved && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">KYC verification required</p>
            <p className="text-xs text-orange-600 mt-0.5">
              Complete institutional KYC to unlock trading.{' '}
              <Link href="/kyc" className="underline font-medium">Verify now →</Link>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Token Holdings', value: `${parseFloat(balance?.balance ?? '0').toFixed(4)} AUR`, icon: <Coins className="h-5 w-5 text-gold-500" /> },
          { label: 'Portfolio Value', value: formatUsd(balance?.balanceUsd ?? '0'), icon: <DollarSign className="h-5 w-5 text-green-500" /> },
          { label: 'Total Volume', value: formatUsd(totalVolume), icon: <TrendingUp className="h-5 w-5 text-blue-500" /> },
          { label: 'Gold Price', value: balance?.goldPriceUsd ? formatUsd(balance.goldPriceUsd) + '/oz' : '—', icon: <TrendingUp className="h-5 w-5 text-amber-500" /> },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-start gap-3">
            <div className="rounded-lg bg-gray-50 p-2">{stat.icon}</div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/orders?new=buy" className="flex items-center justify-center rounded-lg border border-gold-300 bg-gold-50 py-3 text-sm font-medium text-gold-700 hover:bg-gold-100 transition-colors">
              Buy Tokens
            </Link>
            <Link href="/orders?new=sell" className="flex items-center justify-center rounded-lg border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Sell Tokens
            </Link>
            <Link href="/reports" className="col-span-2 flex items-center justify-center rounded-lg border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Download Report
            </Link>
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Order Summary</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Total orders</dt>
              <dd className="font-medium">{totalOrders}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Completed</dt>
              <dd className="font-medium text-green-600">{completedOrders}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">In progress</dt>
              <dd className="font-medium">{totalOrders - completedOrders}</dd>
            </div>
          </dl>
          <Link href="/orders" className="mt-4 block text-center text-xs text-gold-600 hover:underline">
            View all orders →
          </Link>
        </div>
      </div>

      {/* Recent orders table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Recent Transactions</h2>
          <Link href="/orders" className="text-xs text-gold-600 hover:underline">All orders →</Link>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
          </div>
        ) : !orderList?.length ? (
          <p className="py-8 text-center text-sm text-gray-400">No orders yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 text-xs text-gray-500">
                <th className="px-6 py-3 text-left font-medium">Type</th>
                <th className="px-6 py-3 text-left font-medium">Amount</th>
                <th className="px-6 py-3 text-left font-medium">Tokens</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {orderList.slice(0, 5).map((order) => (
                <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 font-semibold text-sm">
                    <span className={order.type === 'BUY' ? 'text-green-600' : 'text-red-600'}>{order.type}</span>
                  </td>
                  <td className="px-6 py-3">{formatUsd(order.amountUsd)}</td>
                  <td className="px-6 py-3 text-gray-600">{parseFloat(order.tokenAmount).toFixed(4)} AUR</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-400">{formatDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
