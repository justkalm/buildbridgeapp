'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { monthLabelOf, reportToText, type ContractorReport } from '@/lib/lead-report';

type Loaded = { contractor: { id: string; name: string; tier: 'LISTED' | 'PLUS' | 'PRO' }; month: string; report: ContractorReport };

const STATUS_WORDS = { PENDING: 'Pending', CONTACTED: 'Contacted', QUOTED: 'Quoted', DECLINED: 'Declined', CLOSED: 'Closed' } as const;

function whenIst(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function TallyTable({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  return (
    <div className="break-inside-avoid">
      <h3 className="font-display text-base mb-1.5">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-stone">None</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {items.map((t) => (
              <tr key={t.label} className="border-b border-line/70">
                <td className="py-1 pr-3">{t.label}</td>
                <td className="py-1 text-right tabular-nums">{t.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ReportView({ contractorId, month }: { contractorId: string; month: string | null }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [today] = useState(() =>
    new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' })
  );

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ contractor: contractorId });
    if (month) query.set('month', month);
    fetch(`/api/admin/leads/report?${query}`)
      .then(async (res) => {
        if (res.status === 401) throw new Error('Your admin session has expired. Please log in again.');
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Could not load the report.');
        return res.json();
      })
      .then((json: Loaded) => !cancelled && setData(json))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [contractorId, month]);

  async function copyText() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(reportToText(data.report, data.contractor.name, data.month));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert('Could not copy. Use Print / Save as PDF instead.');
    }
  }

  const r = data?.report;

  return (
    <main className="min-h-screen bg-paper print:bg-white py-10 px-6 print:p-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
          <Link href={`/admin/leads`} className="text-sm text-stone hover:text-ink">
            ← Back to Leads
          </Link>
          {data && (
            <div className="flex gap-2">
              <button onClick={copyText} className="text-xs font-medium px-3.5 py-2 rounded-full border border-line bg-white hover:border-ink">
                {copied ? 'Copied' : 'Copy as text (WhatsApp)'}
              </button>
              <button onClick={() => window.print()} className="text-xs font-medium px-3.5 py-2 rounded-full bg-ink text-paper">
                Print / Save as PDF
              </button>
            </div>
          )}
        </div>

        {error && <div className="bg-danger-soft border border-danger/30 text-danger text-sm rounded-md p-4">{error}</div>}
        {!data && !error && <p className="text-stone text-sm">Loading…</p>}

        {data && r && (
          <article className="bg-white border border-line print:border-0 rounded-md p-8 print:p-0">
            <p className="text-stone text-sm mb-2">(kalm)</p>
            <h1 className="font-display text-3xl mb-1">Lead report</h1>
            <p className="text-stone text-sm mb-6">
              {data.contractor.name} · {monthLabelOf(data.month)} (India time) · prepared {today}
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 border-y border-line py-4 mb-6">
              {[
                ['Leads', r.total],
                ['Replied in app', r.repliedInApp],
                ['Marked contacted', r.contacted],
                ['Quoted', r.quoted],
                ['Declined', r.declined],
                ['Still waiting', r.waiting],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <div className="font-display text-3xl leading-none tabular-nums">{value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-stone mt-1.5">{label}</div>
                </div>
              ))}
            </div>

            <div className="grid sm:grid-cols-3 gap-8 mb-8">
              <TallyTable title="How they arrived" items={r.byMedium} />
              <TallyTable title="Where the projects are" items={r.byLocation} />
              <TallyTable title="Type of work" items={r.byProjectType} />
            </div>

            <h2 className="font-display text-xl mb-2">Every lead</h2>
            {r.leads.length === 0 ? (
              <p className="text-sm text-stone mb-6">No leads this month.</p>
            ) : (
              <table className="w-full text-xs mb-6">
                <thead>
                  <tr className="text-left text-stone border-b border-line">
                    <th className="py-1.5 pr-3 font-normal">Received</th>
                    <th className="py-1.5 pr-3 font-normal">Developer</th>
                    <th className="py-1.5 pr-3 font-normal">Project</th>
                    <th className="py-1.5 pr-3 font-normal">Area</th>
                    <th className="py-1.5 pr-3 font-normal">How it arrived</th>
                    <th className="py-1.5 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {r.leads.map((l) => (
                    <tr key={l.id} className="border-b border-line/70 break-inside-avoid align-top">
                      <td className="py-1.5 pr-3 whitespace-nowrap">{whenIst(l.receivedAt)}</td>
                      <td className="py-1.5 pr-3">{l.developerName}</td>
                      <td className="py-1.5 pr-3">{l.projectType}</td>
                      <td className="py-1.5 pr-3">{l.location || '-'}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{l.medium}</td>
                      <td className="py-1.5 whitespace-nowrap">
                        {l.statusLabel ?? STATUS_WORDS[l.status]}
                        {l.repliedInApp && !l.statusLabel ? ', replied' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {r.hiddenCount > 0 && (
              <p className="text-sm mb-4">
                {r.hiddenCount} of this month&apos;s leads came after the {r.freeCap} full leads the free plan includes, so
                contact details for {r.hiddenCount === 1 ? 'it are' : 'them are'} not shown.
              </p>
            )}
            <p className="text-[11px] text-stone leading-relaxed">
              This report counts activity inside (kalm) only. Replies by phone, email or WhatsApp outside the app are not
              visible to us unless you mark the lead Contacted in your dashboard. Developer contact details are never
              included here.
            </p>
          </article>
        )}
      </div>
    </main>
  );
}
