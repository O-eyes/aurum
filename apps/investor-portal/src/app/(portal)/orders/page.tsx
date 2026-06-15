'use client';

import { useQuery } from '@tanstack/react-query';
import { orders as ordersApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { formatUsd, formatDate, formatGhs, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/utils';
import { useGhsRate } from '@/hooks/useGhsRate';
import Link from 'next/link';

export default function OrdersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: ordersApi.list,
  });
  const ghsRate = useGhsRate();

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Order History</h1>

      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-500">Failed to load orders</p>
          ) : !data?.length ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500 mb-4">No orders yet</p>
              <div className="flex justify-center gap-3">
                <Link
                  href="/orders/buy"
                  className="text-sm font-medium text-gold-600 hover:underline"
                >
                  Buy gold tokens →
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="px-6 py-3 text-left font-medium">Type</th>
                    <th className="px-6 py-3 text-left font-medium">Amount</th>
                    <th className="px-6 py-3 text-left font-medium">Gold oz</th>
                    <th className="px-6 py-3 text-left font-medium">Tokens</th>
                    <th className="px-6 py-3 text-left font-medium">Price/oz</th>
                    <th className="px-6 py-3 text-left font-medium">Status</th>
                    <th className="px-6 py-3 text-left font-medium">Date</th>
                    <th className="px-6 py-3 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-3">
                        <span
                          className={`font-semibold ${
                            order.type === 'BUY' ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {order.type}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-900 font-medium">
                        {ghsRate ? formatGhs(order.amountUsd, ghsRate) : formatUsd(order.amountUsd)}
                        <p className="text-xs text-gray-400 mt-0">{formatUsd(order.amountUsd)}</p>
                      </td>
                      <td className="px-6 py-3 text-gray-600">
                        {parseFloat(order.goldOunces).toFixed(6)}
                      </td>
                      <td className="px-6 py-3 text-gray-600">
                        {parseFloat(order.tokenAmount).toFixed(4)} AUR
                      </td>
                      <td className="px-6 py-3 text-gray-500">
                        {formatUsd(order.goldPriceUsd)}
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
                      <td className="px-6 py-3 text-gray-400 text-xs">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-3">
                        <Link
                          href={`/orders/${order.id}`}
                          className="text-xs text-gold-600 hover:underline"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
