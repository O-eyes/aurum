'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kyc as kycApi, ApiError, type KycProfile } from '@/lib/api';
import { formatDate, KYC_STATUS_COLORS } from '@/lib/utils';
import { useToast } from '@/contexts/toast-context';

export default function KycReviewPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState<KycProfile | null>(null);
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState('');

  const { data: queue, isLoading } = useQuery({
    queryKey: ['kyc-queue'],
    queryFn: kycApi.reviewQueue,
    refetchInterval: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => kycApi.approve(id, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-queue'] });
      setSelected(null);
      setNote('');
      setActionError('');
      toast.success('KYC application approved.');
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Approval failed';
      setActionError(msg);
      toast.error(msg);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => kycApi.reject(id, { note: note || 'Documents did not meet requirements' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-queue'] });
      setSelected(null);
      setNote('');
      setActionError('');
      toast.success('KYC application rejected.');
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Rejection failed';
      setActionError(msg);
      toast.error(msg);
    },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">KYC Review Queue</h1>

      <div className="flex gap-6">
        {/* Queue list */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Applications</h2>
            {queue && <span className="text-xs text-gray-400">{queue.length} total</span>}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : !queue?.length ? (
            <p className="px-6 py-8 text-center text-sm text-gray-400">
              No applications in the review queue
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {queue.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setSelected(item); setNote(''); setActionError(''); }}
                  className={`w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors ${
                    selected?.id === item.id ? 'bg-brand-50' : ''
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {item.user.firstName ?? ''} {item.user.lastName ?? ''}
                    </p>
                    <p className="text-xs text-gray-400">{item.user.email}</p>
                    <p className="text-xs text-gray-300 mt-1">{formatDate(item.updatedAt)}</p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      KYC_STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {item.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail / action panel */}
        <div className="w-80">
          {selected ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm space-y-4 p-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {selected.user.firstName ?? ''} {selected.user.lastName ?? 'Applicant'}
                </h3>
                <p className="text-xs text-gray-400">{selected.user.email}</p>
              </div>

              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-gray-500">KYC ID</dt>
                  <dd className="font-mono text-gray-700 break-all max-w-[140px]">{selected.id.slice(0, 16)}…</dd>
                </div>
                {selected.externalId && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Sumsub ID</dt>
                    <dd className="font-mono text-gray-700">{selected.externalId.slice(0, 12)}…</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">Status</dt>
                  <dd>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${KYC_STATUS_COLORS[selected.status] ?? ''}`}>
                      {selected.status}
                    </span>
                  </dd>
                </div>
              </dl>

              {selected.reviewNote && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-800">
                  <strong>Prior note:</strong> {selected.reviewNote}
                </div>
              )}

              {selected.status === 'UNDER_REVIEW' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Review note (optional for approve, required for reject)
                    </label>
                    <textarea
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add a note for the applicant…"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    />
                  </div>

                  {actionError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                      {actionError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => approveMutation.mutate(selected.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="flex-1 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-medium py-2 transition-colors disabled:opacity-50"
                    >
                      {approveMutation.isPending ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate(selected.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending || !note}
                      className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium py-2 transition-colors disabled:opacity-50"
                    >
                      {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 text-center">Note is required to reject.</p>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
              <p className="text-sm text-gray-400">Select an application to review</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
