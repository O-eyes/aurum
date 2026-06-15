'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { orders as ordersApi, users, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { formatUsd, formatDate, formatGhs, formatGhsDirect, generateIdempotencyKey, ORDER_STATUS_COLORS } from '@/lib/utils';
import { useGhsRate } from '@/hooks/useGhsRate';
import { Select, type SelectOption } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { useAccount } from 'wagmi';
import { Suspense } from 'react';
import { cn } from '@/lib/utils';
import { TENANT } from '@/lib/tenant.config';

const USD_PRESETS = [10_000, 25_000, 50_000, 100_000, 250_000];
const OZ_PRESETS = [1, 5, 10, 50, 100];

const ORDER_TYPE_OPTIONS: SelectOption[] = [
  { value: 'BUY', label: 'BUY' },
  { value: 'SELL', label: 'SELL' },
];

const orderSchema = z.object({
  type: z.enum(['BUY', 'SELL']),
  amountGhs: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount')
    .refine((v) => parseFloat(v) >= TENANT.minimumGhs, `Minimum GH₵${TENANT.minimumGhs.toLocaleString()}`),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address'),
});
type OrderForm = z.infer<typeof orderSchema>;

function OrdersPageInner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const defaultType = searchParams.get('new') === 'sell' ? 'SELL' : 'BUY';
  const [showForm, setShowForm] = useState(!!searchParams.get('new'));
  const [formError, setFormError] = useState('');
  const [inputMode, setInputMode] = useState<'ghs' | 'oz'>('ghs');
  const { address } = useAccount();

  const { data: balance } = useQuery({ queryKey: ['balance'], queryFn: users.balance });
  const { data: orderList, isLoading } = useQuery({ queryKey: ['orders'], queryFn: ordersApi.list });

  const goldPriceUsd = parseFloat(balance?.goldPriceUsd ?? '0');
  const ghsRate = useGhsRate();

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting }, reset } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: { type: defaultType, walletAddress: address ?? '' },
  });

  const type = watch('type');
  const amountGhs = watch('amountGhs');
  const amountUsd = ghsRate && amountGhs ? parseFloat(amountGhs) / ghsRate : null;
  const estimatedOz = goldPriceUsd && amountUsd ? amountUsd / goldPriceUsd : null;

  const setGhsFromOz = (oz: number) => {
    if (!goldPriceUsd || !ghsRate) return;
    setValue('amountGhs', (oz * goldPriceUsd * ghsRate).toFixed(2), { shouldValidate: true });
  };

  const createMutation = useMutation({
    mutationFn: (data: OrderForm) => {
      if (!ghsRate) throw new Error('Exchange rate unavailable. Please try again.');
      const usd = (parseFloat(data.amountGhs) / ghsRate).toFixed(2);
      return ordersApi.create({
        type: data.type,
        amountUsd: usd,
        walletAddress: data.walletAddress,
        idempotencyKey: generateIdempotencyKey(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowForm(false);
      reset();
      setFormError('');
    },
    onError: (e) => setFormError(e instanceof ApiError ? e.message : (e as Error).message || 'Failed to create order'),
  });

  const kycApproved = user?.kycStatus === 'APPROVED';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Orders</h1>
        {kycApproved && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-gold-500 hover:bg-gold-600 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" /> New Order
          </button>
        )}
      </div>

      {/* New order form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">New Order</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="h-4 w-4" />
            </button>
          </div>

          {formError && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Order type */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Type</label>
                <Select
                  options={ORDER_TYPE_OPTIONS}
                  value={type}
                  onChange={(v) => setValue('type', v as OrderForm['type'])}
                />
              </div>

              {/* Amount with GHS/oz toggle */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount</label>
                  {type === 'BUY' && (
                    <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setInputMode('ghs')}
                        className={cn(
                          'px-2 py-0.5 text-xs transition-colors',
                          inputMode === 'ghs'
                            ? 'bg-gold-500 text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
                        )}
                      >
                        GH₵
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputMode('oz')}
                        className={cn(
                          'px-2 py-0.5 text-xs transition-colors',
                          inputMode === 'oz'
                            ? 'bg-gold-500 text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
                        )}
                      >
                        oz
                      </button>
                    </div>
                  )}
                </div>

                {inputMode === 'oz' && type === 'BUY' ? (
                  <div>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      placeholder="10.000"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                      onChange={(e) => setGhsFromOz(parseFloat(e.target.value) || 0)}
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      {amountGhs && ghsRate ? `= ${formatGhsDirect(amountGhs)}` : 'Enter oz to calculate'}
                    </p>
                  </div>
                ) : (
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      min={TENANT.minimumGhs}
                      placeholder="150,000.00"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                      {...register('amountGhs')}
                    />
                    {amountUsd && (
                      <p className="mt-1 text-xs text-gray-400">
                        ≈ {formatUsd(amountUsd)}
                        {estimatedOz ? ` · ${estimatedOz.toFixed(4)} oz` : ''}
                      </p>
                    )}
                  </div>
                )}
                {errors.amountGhs && <p className="mt-1 text-xs text-red-600">{errors.amountGhs.message}</p>}

                {/* Presets */}
                {type === 'BUY' && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {inputMode === 'oz'
                      ? OZ_PRESETS.map((oz) => (
                          <button
                            key={oz}
                            type="button"
                            onClick={() => setGhsFromOz(oz)}
                            className="rounded-md border border-gray-200 dark:border-gray-600 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400 hover:border-gold-400 hover:text-gold-600 dark:hover:text-gold-400 transition-colors"
                          >
                            {oz}oz
                          </button>
                        ))
                      : USD_PRESETS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              const ghs = ghsRate ? (p * ghsRate).toFixed(2) : String(p * 15);
                              setValue('amountGhs', ghs, { shouldValidate: true });
                            }}
                            className="rounded-md border border-gray-200 dark:border-gray-600 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400 hover:border-gold-400 hover:text-gold-600 dark:hover:text-gold-400 transition-colors"
                          >
                            {ghsRate ? `GH₵${Math.round(p * ghsRate).toLocaleString()}` : `$${p.toLocaleString()}`}
                          </button>
                        ))}
                  </div>
                )}
              </div>

              {/* Wallet */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Wallet Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  {...register('walletAddress')}
                />
                {address && (
                  <button
                    type="button"
                    onClick={() => setValue('walletAddress', address)}
                    className="mt-1 text-xs text-gold-600 hover:underline"
                  >
                    Use connected ({address.slice(0, 6)}…{address.slice(-4)})
                  </button>
                )}
                {errors.walletAddress && <p className="mt-1 text-xs text-red-600">{errors.walletAddress.message}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-gold-500 hover:bg-gold-600 text-white font-medium px-6 py-2 text-sm transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Placing…' : `Place ${type} Order`}
              </button>
              {goldPriceUsd > 0 && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Gold: {formatUsd(goldPriceUsd)}/oz
                  {ghsRate && ` · GH₵${(goldPriceUsd * ghsRate).toLocaleString('en-US', { maximumFractionDigits: 0 })}/oz`}
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Orders table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            All Orders ({orderList?.length ?? 0})
          </h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
          </div>
        ) : !orderList?.length ? (
          <p className="py-8 text-center text-sm text-gray-400">No orders yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  <th className="px-6 py-3 text-left font-medium">Type</th>
                  <th className="px-6 py-3 text-left font-medium">Amount</th>
                  <th className="px-6 py-3 text-left font-medium">Tokens</th>
                  <th className="px-6 py-3 text-left font-medium">Gold oz</th>
                  <th className="px-6 py-3 text-left font-medium">Price/oz</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {orderList.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-6 py-3 font-semibold">
                      <span className={order.type === 'BUY' ? 'text-green-600' : 'text-red-500'}>
                        {order.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {ghsRate ? formatGhs(order.amountUsd, ghsRate) : formatUsd(order.amountUsd)}
                      <p className="text-xs text-gray-400 font-normal mt-0">{formatUsd(order.amountUsd)}</p>
                    </td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400">
                      {parseFloat(order.tokenAmount).toFixed(4)} AUR
                    </td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400">
                      {parseFloat(order.goldOunces).toFixed(4)} oz
                    </td>
                    <td className="px-6 py-3 text-gray-500 dark:text-gray-500">
                      {formatUsd(order.goldPriceUsd)}
                    </td>
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
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return <Suspense><OrdersPageInner /></Suspense>;
}
