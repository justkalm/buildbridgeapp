// src/app/admin/leads/page.tsx
//
// Lead ledger (KALM-259): per contractor, leads in a month, how many were
// replied to, quoted, declined, still waiting, and how many a free contractor
// could not see in full. Month picker (India-time months) and a CSV download.
// Counts in-app activity only: replies by email or WhatsApp outside the app
// are invisible here, and email delivery is not tracked.

'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminTabs from '@/components/AdminTabs';

type Row = {
  contractorId: string;
  name: string;
  tier: 'LISTED' | 'PLUS' | 'PRO';
  leads: number;
  byQuote: number;
  byEnquiry: number;
  byProject: number;
  bySiteVisit: number;
  emailFailed: number;
  replied: number;
  contacted: number;
  quoted: number;
  declined: number;
  waiting: number;
  overFreeCap: number;
};
type Totals = Omit<Row, 'contractorId' | 'name' | 'tier'>;
type Detail = {
  id: string;
  contractorId: string;
  developerName: string;
  developerEmail: string;
  medium: 'Quote form' | 'Message' | 'Project post' | 'Site visit';
  status: 'PENDING' | 'CONTACTED' | 'QUOTED' | 'DECLINED' | 'CLOSED';
  statusLabel?: string;
  repliedInApp: boolean;
  createdAt: string;
};
type LedgerData = { month: string; months: string[]; rows: Row[]; totals: Totals; details: Detail[] };

const STATUS_WORDS: Record<Detail['status'], string> = {
  PENDING: 'Pending',
  CONTACTED: 'Contacted',
  QUOTED: 'Quoted',
  DECLINED: 'Declined',
  CLOSED: 'Closed',
};

function whenIst(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

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
  { key: 'bySiteVisit', label: 'Site visit', hint: 'Arrived as a request to visit the contractor\'s projects. Site visits count as leads and follow the same free-plan cap.' },
  { key: 'emailFailed', label: 'Failed emails', hint: 'Emails to this contractor that failed to send this month (also listed under Failed emails). Delivery is not tracked, so zero does not prove an email arrived.' },
  { key: 'replied', label: 'Replied', hint: 'The contractor sent at least one message in the app' },
  { key: 'contacted', label: 'Contacted', hint: 'The contractor marked Contacted: they spoke to the developer outside the app (phone, email or WhatsApp). Their own word, not checked.' },
  { key: 'quoted', label: 'Quoted', hint: 'Marked Quote sent' },
  { key: 'declined', label: 'Declined', hint: 'Marked Not interested' },
  { key: 'waiting', label: 'Waiting', hint: 'Still Pending and no reply yet' },
  { key: 'overFreeCap', label: 'Over free cap', hint: 'Leads above the free five (counted for the month shown, using the contractor\'s plan today)' },
];

export default function AdminLeadsPage() {
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<LedgerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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
                  setOpenId(null);
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
              <>
                <a
                  href={`/api/admin/leads?month=${current}&format=csv`}
                  className="text-sm font-medium text-sage underline underline-offset-2"
                >
                  Totals CSV
                </a>
                <a
                  href={`/api/admin/leads?month=${current}&format=csv-leads`}
                  className="text-sm font-medium text-sage underline underline-offset-2"
                >
                  Every lead CSV
                </a>
              </>
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
                {data.rows.map((r) => {
                  const open = openId === r.contractorId;
                  const leads = data.details.filter((d) => d.contractorId === r.contractorId);
                  return (
                    <Fragment key={r.contractorId}>
                      <tr className="border-b border-line">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setOpenId(open ? null : r.contractorId)}
                            aria-expanded={open}
                            className="font-medium text-left underline-offset-2 hover:underline"
                          >
                            {r.name} <span className="text-stone text-xs">{open ? '▾' : '▸'}</span>
                          </button>
                          <div className="text-[11px] text-stone">
                            {r.tier === 'LISTED' ? 'Listed (free)' : r.tier === 'PLUS' ? 'Plus' : 'Pro'} ·{' '}
                            <Link
                              href={`/admin/leads/${r.contractorId}?month=${data.month}`}
                              className="text-sage font-medium underline underline-offset-2"
                            >
                              Report to send
                            </Link>
                          </div>
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
                      {open && (
                        <tr className="border-b border-line bg-paper-dim/40">
                          <td colSpan={COLUMNS.length + 1} className="px-4 py-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-stone">
                                  <th className="py-1 pr-3 font-normal">Received (India time)</th>
                                  <th className="py-1 pr-3 font-normal">Developer</th>
                                  <th className="py-1 pr-3 font-normal">How it arrived</th>
                                  <th className="py-1 pr-3 font-normal">Status</th>
                                  <th className="py-1 font-normal">Replied in app</th>
                                </tr>
                              </thead>
                              <tbody>
                                {leads.map((d) => (
                                  <tr key={d.id} className="border-t border-line/70">
                                    <td className="py-1.5 pr-3 whitespace-nowrap">{whenIst(d.createdAt)}</td>
                                    <td className="py-1.5 pr-3">
                                      <span className="font-medium text-ink">{d.developerName}</span>{' '}
                                      <span className="text-stone">{d.developerEmail}</span>
                                    </td>
                                    <td className="py-1.5 pr-3 whitespace-nowrap">{d.medium}</td>
                                    <td className="py-1.5 pr-3 whitespace-nowrap">{d.statusLabel ?? STATUS_WORDS[d.status]}</td>
                                    <td className="py-1.5">{d.repliedInApp ? 'Yes' : 'No'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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
