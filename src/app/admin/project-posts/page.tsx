// src/app/admin/project-posts/page.tsx
//
// Lists ProjectPosts submitted via the developer-facing /post-project
// form. For each one, admin can pick contractor(s) to alert — the picker
// is filtered to tier === PRO client-side for a clean UX (no point showing
// LISTED/PLUS contractors as options at all), but the REAL enforcement is
// server-side in the alert route — see that route's header comment. Don't
// rely on this filter alone; a client-side-only restriction is not a
// security boundary.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Alert = {
  alertedAt: string;
  contractor: { id: string; name: string };
};

type ProjectPostRow = {
  id: string;
  projectType: string;
  location: string;
  budgetRangeLabel: string;
  details: string;
  contactPhone: string;
  status: 'NEW' | 'MATCHED' | 'CLOSED';
  createdAt: string;
  developer: { name: string; email: string };
  alerts: Alert[];
};

type ProContractor = { id: string; name: string; tier: 'LISTED' | 'PLUS' | 'PRO' };

const statusStyle: Record<ProjectPostRow['status'], string> = {
  NEW: 'bg-sage-soft text-sage',
  MATCHED: 'bg-verified-soft text-verified',
  CLOSED: 'bg-paper-dim text-stone',
};

export default function AdminProjectPostsPage() {
  const [posts, setPosts] = useState<ProjectPostRow[] | null>(null);
  const [proContractors, setProContractors] = useState<ProContractor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch('/api/admin/project-posts')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setPosts)
      .catch(() => setError('Failed to load project posts'));

    // Reuses the existing admin contractors list endpoint rather than a
    // new one — filters to PRO client-side. See file header comment on
    // why this filter is UX-only, not the real enforcement.
    fetch('/api/admin/contractors')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((all: ProContractor[]) => setProContractors(all.filter((c) => c.tier === 'PRO')))
      .catch(() => {});
  }, []);

  function openPicker(postId: string) {
    setOpenPickerFor(postId);
    setSelected(new Set());
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendAlerts(postId: string) {
    if (selected.size === 0) return;
    setSending(true);

    try {
      const res = await fetch(`/api/admin/project-posts/${postId}/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorIds: Array.from(selected) }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error ?? 'Failed to send alerts');
        setSending(false);
        return;
      }

      // Refetch rather than patch local state — alert send also flips
      // status to MATCHED and adds rows to `alerts`, simpler to just
      // reload the list than reconstruct that shape by hand.
      const refreshed = await fetch('/api/admin/project-posts');
      if (refreshed.ok) setPosts(await refreshed.json());

      setOpenPickerFor(null);
      setSelected(new Set());
    } catch {
      alert('Failed to send alerts. Please try again.');
    }
    setSending(false);
  }

  return (
    <main className="min-h-screen bg-paper py-10 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display font-bold text-2xl tracking-tight">Project Posts</h1>
          <Link href="/admin/contractors" className="text-sm text-stone hover:text-ink">
            ← Back to contractors
          </Link>
        </div>
        <p className="text-stone text-sm mb-8">
          {posts ? `${posts.length} project${posts.length === 1 ? '' : 's'} posted` : 'Loading…'}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-4 mb-6">
            {error}
          </div>
        )}

        {!error && posts && posts.length === 0 && (
          <div className="border border-line rounded-md p-10 text-center bg-white">
            <p className="text-stone font-medium">No projects posted yet</p>
          </div>
        )}

        {posts && posts.length > 0 && (
          <div className="flex flex-col gap-4">
            {posts.map((p) => (
              <div key={p.id} className="border border-line rounded-md p-5 bg-white">
                <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                  <div>
                    <p className="font-medium text-sm">{p.developer.name} ({p.developer.email})</p>
                    <p className="text-stone text-xs mt-0.5">
                      {p.projectType} · {p.location} · {p.budgetRangeLabel} · {p.contactPhone}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusStyle[p.status]}`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-sm mb-3">{p.details}</p>

                {p.alerts.length > 0 && (
                  <p className="text-xs text-stone mb-3">
                    Alerted: {p.alerts.map((a) => a.contractor.name).join(', ')}
                  </p>
                )}

                {openPickerFor === p.id ? (
                  <div className="border-t border-line pt-3 mt-1">
                    <p className="text-xs text-stone mb-2">Select PRO contractor(s) to alert:</p>
                    {!proContractors ? (
                      <p className="text-xs text-stone">Loading contractors…</p>
                    ) : proContractors.length === 0 ? (
                      <p className="text-xs text-stone">No PRO contractors yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {proContractors.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleSelected(c.id)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                              selected.has(c.id)
                                ? 'bg-ink text-paper border-ink'
                                : 'border-line text-stone hover:border-ink'
                            }`}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => sendAlerts(p.id)}
                        disabled={sending || selected.size === 0}
                        className="text-xs font-medium px-4 py-2 rounded-full bg-ink text-paper disabled:opacity-50"
                      >
                        {sending ? 'Sending…' : `Send alert (${selected.size})`}
                      </button>
                      <button
                        onClick={() => setOpenPickerFor(null)}
                        className="text-xs font-medium px-4 py-2 rounded-full border border-line"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openPicker(p.id)}
                    className="text-xs font-medium text-sage"
                  >
                    + Alert PRO contractor(s)
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
