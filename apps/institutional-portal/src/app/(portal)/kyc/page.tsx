'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kyc as kycApi, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { SumsubWidget } from '@/components/kyc/sumsub-widget';
import { formatDate } from '@/lib/utils';
import { Shield, CheckCircle2, Clock, XCircle, AlertTriangle, ChevronDown } from 'lucide-react';

const STATUS_ICON: Record<string, React.ReactNode> = {
  APPROVED:     <CheckCircle2 className="h-10 w-10 text-green-500" />,
  UNDER_REVIEW: <Clock className="h-10 w-10 text-blue-400" />,
  REJECTED:     <XCircle className="h-10 w-10 text-red-500" />,
  NEEDS_REVIEW: <AlertTriangle className="h-10 w-10 text-yellow-500" />,
  PENDING:      <Shield className="h-10 w-10 text-gray-300" />,
};

const STATUS_DESC: Record<string, string> = {
  PENDING:      'Start your institutional verification process below.',
  UNDER_REVIEW: 'Documents under review. We will notify you within 2–3 business days.',
  APPROVED:     'Your institution is verified. Full trading access is active.',
  REJECTED:     'Verification rejected. Please resubmit with the correct documentation.',
  NEEDS_REVIEW: 'Additional information required. Please resubmit.',
};

export default function KycPage() {
  const { user, refresh: refreshAuth } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [widgetOpen, setWidgetOpen] = useState(false);

  const { data: kycStatus, isLoading } = useQuery({
    queryKey: ['kyc-status'],
    queryFn: kycApi.status,
    refetchInterval: 30_000,
  });

  const submitMutation = useMutation({
    mutationFn: () => kycApi.submit({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-status'] });
      setWidgetOpen(true);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Submission failed'),
  });

  const handleTokenRefresh = async (): Promise<string> => {
    const result = await kycApi.submit({});
    return result.sdkToken;
  };

  const handleStatusChange = async (reviewStatus: string) => {
    await queryClient.invalidateQueries({ queryKey: ['kyc-status'] });
    await refreshAuth();
    if (reviewStatus === 'completed') setWidgetOpen(false);
  };

  const status = user?.kycStatus ?? 'PENDING';
  const canVerify = status === 'PENDING' || status === 'REJECTED' || status === 'NEEDS_REVIEW';
  const sdkToken = kycStatus?.sdkToken;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">KYC — Institutional Verification</h1>

      <div className="max-w-xl space-y-5">
        {/* Status card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 flex items-center gap-5">
          {STATUS_ICON[status] ?? STATUS_ICON.PENDING}
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{status}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{STATUS_DESC[status] ?? ''}</p>
            {kycStatus?.updatedAt && (
              <p className="text-xs text-gray-400 mt-1">Updated: {formatDate(kycStatus.updatedAt)}</p>
            )}
          </div>
        </div>

        {kycStatus?.reviewNote && (
          <div className="rounded-xl border border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 p-4 text-sm text-yellow-800 dark:text-yellow-300">
            <strong>Note from compliance:</strong> {kycStatus.reviewNote}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Verification section */}
        {canVerify && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {status === 'PENDING' ? 'Begin Verification' : 'Resubmit Verification'}
              </h2>
              {widgetOpen && sdkToken && (
                <button onClick={() => setWidgetOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <ChevronDown className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="p-6">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
                </div>
              ) : widgetOpen && sdkToken ? (
                <SumsubWidget
                  accessToken={sdkToken}
                  onTokenRefresh={handleTokenRefresh}
                  onStatusChange={handleStatusChange}
                />
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Required documentation
                    </p>
                    <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                      {[
                        'Certificate of incorporation or registration',
                        'Beneficial ownership structure (UBO list — all owners > 25%)',
                        'Authorised signatory documents / board resolution',
                        'Government-issued ID for each UBO',
                        'Proof of registered business address',
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      setError('');
                      if (sdkToken) setWidgetOpen(true);
                      else submitMutation.mutate();
                    }}
                    disabled={submitMutation.isPending}
                    className="w-full rounded-lg bg-gold-500 hover:bg-gold-600 text-white font-medium py-2.5 text-sm transition-colors disabled:opacity-50"
                  >
                    {submitMutation.isPending ? 'Starting…' : status === 'PENDING' ? 'Begin Verification' : 'Resubmit Verification'}
                  </button>

                  <p className="text-xs text-gray-400 text-center">Powered by Sumsub. All documents are encrypted and stored securely.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {status === 'APPROVED' && (
          <div className="rounded-xl border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-800 dark:text-green-300">
            Your institution is fully verified. You have unrestricted access to buy, hold, sell, and redeem gold tokens.
          </div>
        )}
      </div>
    </div>
  );
}
