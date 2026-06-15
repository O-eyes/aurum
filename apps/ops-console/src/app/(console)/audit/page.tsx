'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request, type AuditEvent } from '@/lib/api';
import { formatDate } from '@/lib/utils';

function fetchAuditLog(): Promise<AuditEvent[]> {
  return request<AuditEvent[]>('/audit');
}

export default function AuditPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-log'],
    queryFn: fetchAuditLog,
    refetchInterval: 60_000,
  });

  const filtered = (data ?? []).filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.action.toLowerCase().includes(q) ||
      e.actorId?.toLowerCase().includes(q) ||
      e.resourceId?.toLowerCase().includes(q) ||
      e.resource?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
        <span className="text-sm text-gray-400">Append-only · real-time</span>
      </div>

      <input
        type="text"
        placeholder="Filter by action, actor, target…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-72"
      />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-500">Failed to load audit log</p>
        ) : !filtered.length ? (
          <p className="py-8 text-center text-sm text-gray-400">No events found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="px-4 py-3 text-left font-medium">Timestamp</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                  <th className="px-4 py-3 text-left font-medium">Actor</th>
                  <th className="px-4 py-3 text-left font-medium">Target</th>
                  <th className="px-4 py-3 text-left font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event) => (
                  <tr key={event.id} className="border-b border-gray-50 hover:bg-gray-50 font-mono">
                    <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">
                      {formatDate(event.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
                        {event.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 max-w-[120px] truncate">
                      {event.actorId ? event.actorId.slice(0, 8) + '…' : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      <span className="text-gray-400">{event.resource}:</span>{' '}
                      {event.resourceId ? event.resourceId.slice(0, 8) + '…' : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">{event.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">{filtered.length} events</p>
    </div>
  );
}
