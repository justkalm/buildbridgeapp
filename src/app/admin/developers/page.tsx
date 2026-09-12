// src/app/admin/developers/page.tsx
//
// Read-only list of every Developer account (the site's "users") — name,
// email, phone, signup date, and how many quote requests they've sent.
// No edit/delete here by design; see the API route's comment.

'use client';

import { useEffect, useState } from 'react';
import AdminTabs from '@/components/AdminTabs';

type DeveloperRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  _count: { quoteRequests: number };
};

export default function AdminDevelopersPage() {
  const [developers, setDevelopers] = useState<DeveloperRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/developers')
      .then((res) => {
        if (res.status === 401) {
          setError('Your admin session has expired. Please log in again.');
          return null;
        }
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        if (data) setDevelopers(data);
      })
      .catch(() => setError('Could not load users right now.'));
  }, []);

  return (
    <main className="min-h-screen bg-paper py-10 px-6">
      <div className="max-w-4xl mx-auto">
        <AdminTabs active="developers" />
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display font-bold text-2xl tracking-tight">Users</h1>
        </div>
        <p className="text-stone text-sm mb-8">
          {developers ? `${developers.length} user${developers.length === 1 ? '' : 's'} total` : 'Loading…'}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-4 mb-6">
            {error}
          </div>
        )}

        {!error && developers && developers.length === 0 && (
          <div className="border border-line rounded-md p-10 text-center bg-white">
            <p className="text-stone font-medium">No users yet</p>
          </div>
        )}

        {developers && developers.length > 0 && (
          <div className="bg-white border border-line rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[11px] tracking-wider uppercase text-stone">
                  <th className="px-4 py-3 border-b border-line">Name</th>
                  <th className="px-4 py-3 border-b border-line">Email</th>
                  <th className="px-4 py-3 border-b border-line">Phone</th>
                  <th className="px-4 py-3 border-b border-line">Joined</th>
                  <th className="px-4 py-3 border-b border-line">Quote requests</th>
                </tr>
              </thead>
              <tbody>
                {developers.map((d) => (
                  <tr key={d.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-4 font-medium">{d.name}</td>
                    <td className="px-4 py-4 text-stone">{d.email}</td>
                    <td className="px-4 py-4 text-stone">{d.phone ?? '—'}</td>
                    <td className="px-4 py-4 text-stone">
                      {new Date(d.createdAt).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-4 text-stone">{d._count.quoteRequests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
