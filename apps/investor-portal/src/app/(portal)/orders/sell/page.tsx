'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { orders as ordersApi, payments, users, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select, type SelectOption } from '@/components/ui/select';
import { formatUsd, formatGhs, formatGhsDirect, generateIdempotencyKey } from '@/lib/utils';
import { useGhsRate } from '@/hooks/useGhsRate';
import { TENANT } from '@/lib/tenant.config';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { ArrowLeft, Smartphone, Building2 } from 'lucide-react';

const MOMO_OPTIONS: SelectOption[] = [
  { value: 'mtn',     label: 'MTN Mobile Money' },
  { value: 'telecel', label: 'Telecel Cash' },
  { value: 'at',      label: 'AT Money (AirtelTigo)' },
];

const schema = z
  .object({
    amountGhs: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid cedis amount')
      .refine((v) => parseFloat(v) >= TENANT.minimumGhs, `Minimum is GH₵${TENANT.minimumGhs}`),
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Enter a valid wallet address'),
    payoutMethod: z.enum(['mobile_money', 'bank_transfer']),
    accountName: z.string().min(1, 'Account name is required'),
    momoProvider: z.enum(['mtn', 'telecel', 'at']).optional(),
    momoPhone: z.string().optional(),
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.payoutMethod === 'mobile_money') {
      if (!d.momoPhone || d.momoPhone.length < 9)
        ctx.addIssue({ path: ['momoPhone'], message: 'Valid phone number required', code: z.ZodIssueCode.custom });
      if (!d.momoProvider)
        ctx.addIssue({ path: ['momoProvider'], message: 'Select a network', code: z.ZodIssueCode.custom });
    }
    if (d.payoutMethod === 'bank_transfer') {
      if (!d.bankName || d.bankName.length < 2)
        ctx.addIssue({ path: ['bankName'], message: 'Bank name required', code: z.ZodIssueCode.custom });
      if (!d.accountNumber || d.accountNumber.length < 6)
        ctx.addIssue({ path: ['accountNumber'], message: 'Account number required', code: z.ZodIssueCode.custom });
    }
  });

type FormData = z.infer<typeof schema>;

export default function SellPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const { address } = useAccount();
  const [pendingOrder, setPendingOrder] = useState<FormData | null>(null);

  const { data: balance } = useQuery({ queryKey: ['balance'], queryFn: users.balance });

  const goldPriceUsd = parseFloat(balance?.goldPriceUsd ?? '0');
  const tokenBalance = parseFloat(balance?.balance ?? '0');
  const maxSellUsd = tokenBalance * goldPriceUsd;
  const ghsRate = useGhsRate();
  const maxSellGhs = ghsRate ? maxSellUsd * ghsRate : null;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      walletAddress: address ?? '',
      payoutMethod: 'mobile_money' as const,
      momoProvider: 'mtn' as const,
    },
  });

  const payoutMethod = watch('payoutMethod');
  const momoProvider = watch('momoProvider') ?? 'mtn';
  const amountGhs = watch('amountGhs');
  const amountUsd = ghsRate && amountGhs ? parseFloat(amountGhs) / ghsRate : null;
  const estimatedTokens = goldPriceUsd && amountUsd ? amountUsd / goldPriceUsd : null;

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!ghsRate) throw new Error('Exchange rate unavailable. Please try again shortly.');
      const usd = (parseFloat(data.amountGhs) / ghsRate).toFixed(2);

      const order = await ordersApi.create({
        type: 'SELL',
        amountUsd: usd,
        walletAddress: data.walletAddress,
        idempotencyKey: generateIdempotencyKey(),
      });

      await payments.setPayoutMethod(order.id, {
        method: data.payoutMethod === 'mobile_money' ? 'mobile_money' : 'bank',
        currency: data.payoutMethod === 'mobile_money' ? 'GHS' : 'USD',
        accountName: data.accountName,
        phone: data.payoutMethod === 'mobile_money' ? data.momoPhone : undefined,
        network: data.payoutMethod === 'mobile_money' ? data.momoProvider : undefined,
        accountNumber: data.payoutMethod === 'bank_transfer' ? data.accountNumber : undefined,
        bankCode: data.payoutMethod === 'bank_transfer' ? data.bankName : undefined,
      });

      return order;
    },
    onSuccess: (order) => {
      toast.success('Sell order created. Proceed to burn your tokens.', 'Order placed');
      router.push(`/orders/${order.id}`);
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : (e as Error).message || 'Failed to create order', 'Order failed');
    },
  });

  const kycApproved = user?.kycStatus === 'APPROVED';

  const confirmDescription = pendingOrder
    ? [
        `Sell tokens worth ${formatGhsDirect(pendingOrder.amountGhs)}${amountUsd ? ` (≈ ${formatUsd(amountUsd)})` : ''}.`,
        `You will burn ~${estimatedTokens?.toFixed(4) ?? '?'} AUR from wallet ${pendingOrder.walletAddress.slice(0, 8)}…${pendingOrder.walletAddress.slice(-6)}.`,
        '',
        pendingOrder.payoutMethod === 'mobile_money'
          ? `Payout via ${MOMO_OPTIONS.find((p) => p.value === pendingOrder.momoProvider)?.label ?? 'Mobile Money'} to ${pendingOrder.momoPhone} (${pendingOrder.accountName}).`
          : `Payout via bank transfer to ${pendingOrder.accountName} — ${pendingOrder.bankName}, Acc: ${pendingOrder.accountNumber}.`,
        '',
        'Payout is processed within 1–2 business days after your burn is confirmed on-chain.',
      ].join('\n')
    : '';

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Sell Gold Tokens</h1>
      </div>

      {!kycApproved && (
        <Alert variant="warning" title="KYC required">
          Complete verification before selling.{' '}
          <Link href="/kyc" className="font-medium underline">Verify now →</Link>
        </Alert>
      )}

      <form onSubmit={handleSubmit((d) => setPendingOrder(d))}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

          <div className="space-y-6 lg:col-span-3">
            <Card>
              <CardHeader><CardTitle>Token Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Amount to sell (GH₵)"
                  type="number"
                  step="0.01"
                  min={TENANT.minimumGhs}
                  placeholder="500.00"
                  hint={
                    maxSellGhs
                      ? `Balance: ${tokenBalance.toFixed(4)} AUR ≈ ${formatGhsDirect(maxSellGhs, 0)}`
                      : `Balance: ${tokenBalance.toFixed(4)} AUR ≈ ${formatUsd(maxSellUsd)}`
                  }
                  error={errors.amountGhs?.message}
                  {...register('amountGhs')}
                />
                {amountUsd && (
                  <p className="text-xs text-gray-400 -mt-2">≈ {formatUsd(amountUsd)} USD</p>
                )}
                <div>
                  <Input
                    label="Wallet address (tokens burned from here)"
                    placeholder="0x…"
                    error={errors.walletAddress?.message}
                    {...register('walletAddress')}
                  />
                  {address && (
                    <button
                      type="button"
                      className="mt-1 text-xs text-gold-600 hover:underline"
                      onClick={() => setValue('walletAddress', address)}
                    >
                      Use connected wallet ({address.slice(0, 6)}…{address.slice(-4)})
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Payout Destination</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
                    { value: 'bank_transfer', label: 'Bank Transfer', icon: Building2 },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setValue('payoutMethod', value as FormData['payoutMethod'])}
                      className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                        payoutMethod === value
                          ? 'border-gold-500 bg-gold-50 text-gold-700 dark:bg-gold-900/20 dark:text-gold-400'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                <Input
                  label={payoutMethod === 'mobile_money' ? 'Name on MoMo account' : 'Account holder name'}
                  placeholder="Full name as registered"
                  error={errors.accountName?.message}
                  {...register('accountName')}
                />

                {payoutMethod === 'mobile_money' && (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Network
                      </label>
                      <Select
                        options={MOMO_OPTIONS}
                        value={momoProvider}
                        onChange={(v) => setValue('momoProvider', v as FormData['momoProvider'])}
                      />
                      {errors.momoProvider && (
                        <p className="mt-1 text-xs text-red-500">{errors.momoProvider.message}</p>
                      )}
                    </div>
                    <Input
                      label="Phone number"
                      type="tel"
                      placeholder="0244000000"
                      error={errors.momoPhone?.message}
                      {...register('momoPhone')}
                    />
                  </>
                )}

                {payoutMethod === 'bank_transfer' && (
                  <>
                    <Input
                      label="Bank name"
                      placeholder="e.g. GCB Bank, Ecobank"
                      error={errors.bankName?.message}
                      {...register('bankName')}
                    />
                    <Input
                      label="Account number"
                      placeholder="Enter account number"
                      error={errors.accountNumber?.message}
                      {...register('accountNumber')}
                    />
                    <p className="text-xs text-gray-400">
                      Bank transfers are processed manually by our treasury team within 1–2 business days.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader><CardTitle>Sell Summary</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Your balance" value={`${tokenBalance.toFixed(4)} AUR`} />
                <Row label="Gold price" value={goldPriceUsd ? `${formatUsd(goldPriceUsd)}/oz` : '—'} />
                <Row label="Tokens to burn" value={estimatedTokens ? `${estimatedTokens.toFixed(6)} AUR` : '—'} />
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                  <Row
                    label="You receive (est.)"
                    value={amountGhs ? formatGhsDirect(amountGhs) : '—'}
                    sub={amountUsd ? `≈ ${formatUsd(amountUsd)}` : undefined}
                    subHighlight={payoutMethod === 'mobile_money'}
                    bold
                  />
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                  <Row
                    label="Payout via"
                    value={payoutMethod === 'mobile_money' ? 'Mobile Money' : 'Bank Transfer'}
                  />
                </div>
                <Button type="submit" className="w-full mt-2" disabled={!kycApproved}>
                  Review Order
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={!!pendingOrder}
        title="Confirm sell order"
        description={confirmDescription}
        confirmLabel="Place Sell Order"
        onConfirm={() => {
          if (pendingOrder) mutation.mutate(pendingOrder);
          setPendingOrder(null);
        }}
        onCancel={() => setPendingOrder(null)}
      />
    </div>
  );
}

function Row({ label, value, sub, subHighlight, bold }: { label: string; value: string; sub?: string; subHighlight?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <div className="text-right">
        <span className={`${bold ? 'font-semibold' : ''} text-gray-900 dark:text-gray-100`}>{value}</span>
        {sub && (
          <p className={`text-xs mt-0 ${subHighlight ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-400'}`}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
