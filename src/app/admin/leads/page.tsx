// src/app/admin/leads/page.tsx
//
// Lead ledger (KALM-259): per contractor, leads in a month, how many were
// replied to, quoted, declined, still waiting, and how many a free contractor
// could not see in full. Month picker (India-time months) and a CSV download.
// Counts in-app activity only: replies by email or WhatsApp outside the app
// are invisible here, and email delivery is not tracked.

'use client';

import { useEffect, useState } from 'react';
import AdminTabs from '@/components/AdminTabs';

type Row = {
  contractorId: string;
  name: string;
  tier: 'LISTED' | 'PLUS' | 'PRO';
  leads: number;
  byQuote: number;
  byEnquiry: number;
  byProject: number;
  emailFailed: number;
  replied: number;
  quoted: number;
  declined: number;
  waiting: number;
  overFreeCap: number;
};
type Totals = Omit<Row, 'contractorId' | 'name' | 'tier'>;
type LedgerData = { month: string; months: string[]; rows: Row[]; totals: Totals };

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

const COLUMNS: { key: keyof Totals; label: string; hint: string }[] = [
  { key: 'leads', label: 'Leads', hint: 'Quote requests, enquiries and project conversations received' },
  { key: 'byQuote', label: 'Quote form', hint: 'Arrived through the quote form on the contractor profile' },
  { key: 'byEnquiry', label: 'Message', hint: 'Arrived through the Message button on the contractor profile' },
  { key: 'byProject', label: 'Project post', hint: 'Started from a project a developer posted' },
  { key: 'emailFailed', label: 'Failed emails', hint: 'Emails to this contractor that failed to send this month (also listed under Failed emails). Delivery is not tracked, so zero does not prove an email arrived.' },
  { key: 'replied', label: 'Replied', hint: 'The contractor sent at least one message in the app' },
  { key: 'quoted', label: 'Quoted', hint: 'Marked Quote sent' },
  { key: 'declined', label: 'Declined', hint: 'Marked Not interested' },
  { key: 'waiting', label: 'Waiting', hint: 'Still Pending and no reply yet' },
  { key: 'overFreeCap', label: 'Over free cap', hint: 'Leads a free contractor could not see in full (the free plan shows 5 a month)' },
];

export default function AdminLeadsPage() {
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<LedgerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/leads${month ? `?month=${month}` : ''}`)
      .then(async (res) => {
        if (res.status === 401) throw new Error('Your admin session has expired. Please log in again.');
        if (!res.ok) throw new Error('Could not load the lead ledger right now.');
        return res.json();
      })
      .then((json: LedgerData) => {
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const current = data?.month ?? month;

  return (
    <main className="min-h-screen bg-paper py-10 px-6">
      <div className="max-w-4xl mx-auto">
        <AdminTabs active="leads" />
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h1 className="font-display font-bold text-2xl tracking-tight">Leads</h1>
          <div className="flex items-center gap-3">
            {data && (
              <select
                value={data.month}
                onChange={(e) => {
                  setData(null);
                  setMonth(e.target.value);
                }}
                aria-label="Month"
                className="text-sm px-2 py-2 border border-line rounded-[4px] bg-white"
              >
                {data.months.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            )}
            {current && (
              <a
                href={`/api/admin/leads?month=${current}&format=csv`}
                className="text-sm font-medium text-sage underline underline-offset-2"
              >
                Download CSV
              </a>
            )}
          </div>
        </div>
        <p className="text-stone text-sm mb-6">
          {data ? `${monthLabel(data.month)} (India time)` : 'Loading…'}. Counts activity inside (kalm) only: replies by
          email or WhatsApp outside the app are not visible here.
        </p>

        {error && (
          <div className="bg-danger-soft border border-danger/30 text-danger text-sm rounded-md p-4 mb-6">{error}</div>
        )}

        {data && data.rows.length === 0 && !error && (
          <div className="border border-line rounded-md p-10 text-center bg-white">
            <p className="text-stone font-medium">No leads in {monthLabel(data.month)}</p>
          </div>
        )}

        {data && data.rows.length > 0 && (
          <div className="bg-white border border-line rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-left font-mono text-[11px] tracking-wider uppercase text-stone">
                  <th className="px-4 py-3 border-b border-line">Contractor</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} title={c.hint} className="px-3 py-3 border-b border-line text-right">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.contractorId} className="border-b border-line">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[11px] text-stone">{r.tier === 'LISTED' ? 'Listed (free)' : r.tier === 'PLUS' ? 'Plus' : 'Pro'}</div>
                    </td>
                    {COLUMNS.map((c) => (
                      <td
                        key={c.key}
                        className={`px-3 py-3 text-right tabular-nums ${
                          (c.key === 'waiting' || c.key === 'overFreeCap' || c.key === 'emailFailed') && r[c.key] > 0 ? 'text-danger font-medium' : 'text-stone'
                        } ${c.key === 'leads' ? 'text-ink font-medium' : ''}`}
                      >
                        {r[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td className="px-4 py-3">Total</td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-3 py-3 text-right tabular-nums">
                      {data.totals[c.key]}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
