// src/app/admin/emails/page.tsx
//
// Read-only list of the latest 100 emails that failed to send. Fed by
// GET /api/admin/email-failures. Times are shown in India time because the
// server runs in UTC and nobody reading this thinks in UTC.

'use client';

import { useEffect, useState } from 'react';
import AdminTabs from '@/components/AdminTabs';

type FailureRow = {
  id: string;
  createdAt: string;
  label: string;
  to: string;
  error: string;
};

function formatIst(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function AdminEmailFailuresPage() {
  const [rows, setRows] = useState<FailureRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/email-failures')
      .then((res) => {
        if (res.status === 401) {
          setError('Your admin session has expired. Please log in again.');
          return null;
        }
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        if (data) setRows(data);
      })
      .catch(() => setError('Could not load failed emails right now.'));
  }, []);

  return (
    <main className="min-h-screen bg-paper py-10 px-6">
      <div className="max-w-4xl mx-auto">
        <AdminTabs active="emails" />
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display font-bold text-2xl tracking-tight">Failed emails</h1>
        </div>
        <p className="text-stone text-sm mb-8">
          Until the (kalm) domain is verified in Resend, our email service only delivers to
          justkalm26@gmail.com. Emails to anyone else are expected to fail here, so most rows below
          are not a bug. Once the domain is verified, any failure that still shows up is worth a
          look. Showing the latest 100.
        </p>

        {error && (
          <div className="bg-danger-soft border border-danger/30 text-danger text-sm rounded-md p-4 mb-6">
            {error}
          </div>
        )}

        {!error && !rows && <p className="text-stone text-sm">Loading…</p>}

        {!error && rows && rows.length === 0 && (
          <div className="border border-line rounded-md p-10 text-center bg-white">
            <p className="text-stone font-medium">No failed emails</p>
          </div>
        )}

        {rows && rows.length > 0 && (
          <div className="bg-white border border-line rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[11px] tracking-wider uppercase text-stone">
                  <th className="px-4 py-3 border-b border-line whitespace-nowrap">When (IST)</th>
                  <th className="px-4 py-3 border-b border-line">Email</th>
                  <th className="px-4 py-3 border-b border-line">Sent to</th>
                  <th className="px-4 py-3 border-b border-line">Error</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-b-0 align-top">
                    <td className="px-4 py-4 text-stone whitespace-nowrap">{formatIst(r.createdAt)}</td>
                    <td className="px-4 py-4 font-medium">{r.label}</td>
                    <td className="px-4 py-4 text-stone break-all">{r.to}</td>
                    <td className="px-4 py-4 text-danger break-words">{r.error}</td>
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
