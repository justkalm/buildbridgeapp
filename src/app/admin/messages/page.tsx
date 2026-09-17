// src/app/admin/messages/page.tsx
//
// Messaging analytics for admin. Shows aggregate counts and a
// per-contractor breakdown by default — never message content passively.
// Reading an actual conversation requires picking one quote request and
// clicking "View conversation", a deliberate action, framed here (and in
// the API route it calls) as dispute-resolution access rather than
// routine monitoring. See src/app/api/admin/quote-requests/[id]/messages/
// route.ts for the same reasoning on the backend.

'use client';

import { useEffect, useState } from 'react';
import AdminTabs from '@/components/AdminTabs';

type ContractorStat = {
  contractorId: string;
  contractorName: string;
  totalLeads: number;
  threadsWithMessages: number;
  totalMessages: number;
};

type Analytics = {
  totalMessages: number;
  totalThreadsStarted: number;
  totalQuoteRequests: number;
  engagementRate: number;
  contractorStats: ContractorStat[];
};

type ThreadMessage = { id: string; senderRole: 'DEVELOPER' | 'CONTRACTOR'; body: string; createdAt: string };
type ThreadDetail = {
  id: string;
  projectType: string;
  location: string;
  developer: { name: string; email: string };
  contractor: { name: string; email: string };
  messages: ThreadMessage[];
};

export default function AdminMessagesPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoteRequestIdInput, setQuoteRequestIdInput] = useState('');
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);

  useEffect(() => {
    fetch('/api/admin/messages')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setAnalytics)
      .catch(() => setError('Failed to load messaging analytics'));
  }, []);

  async function openThread(id: string) {
    setLoadingThread(true);
    setThreadError(null);
    setThread(null);
    const res = await fetch(`/api/admin/quote-requests/${id}/messages`);
    if (res.ok) {
      setThread(await res.json());
    } else {
      setThreadError('Could not find a quote request with that ID.');
    }
    setLoadingThread(false);
  }

  return (
    <main className="min-h-screen bg-paper py-10 px-6">
      <div className="max-w-4xl mx-auto">
        <AdminTabs active="messages" />
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display font-bold text-2xl tracking-tight">Messages</h1>
        </div>
        <p className="text-stone text-sm mb-8">
          Activity across all in-app conversations. Message content is only shown when you
          deliberately open a specific thread below — this page never lists what anyone actually
          said.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-4 mb-6">
            {error}
          </div>
        )}

        {analytics && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-10">
              <div className="bg-white border border-line rounded-md p-5">
                <p className="text-xs text-stone mb-1">Total messages sent</p>
                <p className="font-display text-3xl">{analytics.totalMessages}</p>
              </div>
              <div className="bg-white border border-line rounded-md p-5">
                <p className="text-xs text-stone mb-1">Leads that became conversations</p>
                <p className="font-display text-3xl">
                  {analytics.totalThreadsStarted}
                  <span className="text-base text-stone"> / {analytics.totalQuoteRequests}</span>
                </p>
              </div>
              <div className="bg-white border border-line rounded-md p-5">
                <p className="text-xs text-stone mb-1">Engagement rate</p>
                <p className="font-display text-3xl">{(analytics.engagementRate * 100).toFixed(0)}%</p>
              </div>
            </div>

            <h2 className="font-display text-lg mb-3">By contractor</h2>
            {analytics.contractorStats.length === 0 ? (
              <p className="text-stone text-sm mb-10">No leads sent to any contractor yet.</p>
            ) : (
              <div className="bg-white border border-line rounded-md overflow-x-auto mb-10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] tracking-wider uppercase text-stone">
                      <th className="px-4 py-3 border-b border-line">Contractor</th>
                      <th className="px-4 py-3 border-b border-line">Leads received</th>
                      <th className="px-4 py-3 border-b border-line">Threads started</th>
                      <th className="px-4 py-3 border-b border-line">Total messages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.contractorStats.map((c) => (
                      <tr key={c.contractorId} className="border-b border-line last:border-b-0">
                        <td className="px-4 py-3 font-medium">{c.contractorName}</td>
                        <td className="px-4 py-3 text-stone">{c.totalLeads}</td>
                        <td className="px-4 py-3 text-stone">{c.threadsWithMessages}</td>
                        <td className="px-4 py-3 text-stone">{c.totalMessages}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <div className="border-t border-line pt-8">
          <h2 className="font-display text-lg mb-2">View a conversation</h2>
          <p className="text-stone text-sm mb-4">
            For dispute resolution — paste a quote request ID to read that specific thread.
          </p>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={quoteRequestIdInput}
              onChange={(e) => setQuoteRequestIdInput(e.target.value)}
              placeholder="Quote request ID"
              className="flex-1 text-sm px-3.5 py-2.5 border border-line rounded-[4px] bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
            />
            <button
              onClick={() => openThread(quoteRequestIdInput.trim())}
              disabled={!quoteRequestIdInput.trim() || loadingThread}
              className="text-sm font-medium px-5 py-2.5 rounded-full bg-ink text-paper disabled:opacity-60"
            >
              {loadingThread ? 'Loading…' : 'View conversation'}
            </button>
          </div>

          {threadError && <p className="text-sm text-red-600 mb-4">{threadError}</p>}

          {thread && (
            <div className="bg-white border border-line rounded-md p-5">
              <p className="text-sm font-medium mb-1">
                {thread.developer.name} ↔ {thread.contractor.name}
              </p>
              <p className="text-xs text-stone mb-4">
                {thread.projectType} · {thread.location}
              </p>
              {thread.messages.length === 0 ? (
                <p className="text-sm text-stone">No messages were exchanged in this thread.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {thread.messages.map((m) => (
                    <div key={m.id} className="text-sm">
                      <span className="font-medium">
                        {m.senderRole === 'DEVELOPER' ? thread.developer.name : thread.contractor.name}:
                      </span>{' '}
                      {m.body}
                      <span className="text-xs text-stone ml-2">
                        {new Date(m.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
