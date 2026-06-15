'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request, type UserProfile } from '@/lib/api';
import { formatDate, KYC_STATUS_COLORS } from '@/lib/utils';

function fetchUsers(): Promise<UserProfile[]> {
  return request<UserProfile[]>('/users');
}

export default function UsersPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    refetchInterval: 60_000,
  });

  const filtered = (data ?? []).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Users</h1>
        {data && <span className="text-sm text-gray-400">{data.length} registered</span>}
      </div>

      <input
        type="text"
        placeholder="Search by email, name, or ID…"
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
          <p className="py-8 text-center text-sm text-red-500">Failed to load users</p>
        ) : !filtered.length ? (
          <p className="py-8 text-center text-sm text-gray-400">No users found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="px-6 py-3 text-left font-medium">User</th>
                <th className="px-6 py-3 text-left font-medium">Roles</th>
                <th className="px-6 py-3 text-left font-medium">KYC Status</th>
                <th className="px-6 py-3 text-left font-medium">Joined</th>
                <th className="px-6 py-3 text-left font-medium">ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <p className="font-medium text-gray-900">
                      {user.firstName ?? ''} {user.lastName ?? ''}
                    </p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {user.roles.map((r) => (
                        <span key={r} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${KYC_STATUS_COLORS[user.kycStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                      {user.kycStatus}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-400">{formatDate(user.createdAt)}</td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-300">{user.id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
