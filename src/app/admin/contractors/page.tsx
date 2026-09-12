// src/app/admin/contractors/page.tsx
//
// Lists every contractor (verified or not) for admin management, with a
// delete action per row and an editable verification-status dropdown.
// Deleting is a real, permanent operation — it cascades to that
// contractor's Projects and QuoteRequests (see the DELETE route's
// comment) — so the confirmation step here explicitly shows the
// quote-request count before deleting, rather than a generic "are you
// sure?" that hides what's actually about to be lost.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminTabs from '@/components/AdminTabs';

type ContractorRow = {
  id: string;
  name: string;
  email: string;
  city: string;
  area: string;
  tradeTypes: string[];
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  tier: 'LISTED' | 'PLUS' | 'PRO';
  licenseNumber: string;
  _count: { projects: number; quoteRequests: number };
};

const statusStyle: Record<ContractorRow['verificationStatus'], string> = {
  VERIFIED: 'bg-verified-soft text-verified',
  PENDING: 'bg-sage-soft text-sage',
  REJECTED: 'bg-red-50 text-red-600',
};

export default function AdminContractorsPage() {
  const [contractors, setContractors] = useState<ContractorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function loadContractors() {
    fetch('/api/admin/contractors')
      .then((res) => {
        if (res.status === 401) {
          setError('Your admin session has expired. Please log in again.');
          return null;
        }
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        if (data) setContractors(data);
      })
      .catch(() => setError('Could not load contractors right now.'));
  }

  useEffect(() => {
    loadContractors();
  }, []);

  async function handleDelete(contractor: ContractorRow) {
    const warning =
      contractor._count.quoteRequests > 0
        ? `Delete ${contractor.name}? This will also permanently delete ${contractor._count.quoteRequests} quote request${contractor._count.quoteRequests === 1 ? '' : 's'} tied to them. This cannot be undone.`
        : `Delete ${contractor.name}? This cannot be undone.`;

    if (!window.confirm(warning)) return;

    setDeletingId(contractor.id);
    try {
      const res = await fetch(`/api/admin/contractors/${contractor.id}`, { method: 'DELETE' });
      if (res.ok) {
        setContractors((prev) => (prev ? prev.filter((c) => c.id !== contractor.id) : prev));
      } else {
        const data = await res.json();
        alert(data.error ?? 'Failed to delete contractor');
      }
    } catch {
      alert('Failed to delete contractor. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleStatusChange(
    contractor: ContractorRow,
    verificationStatus: ContractorRow['verificationStatus']
  ) {
    const previous = contractor.verificationStatus;
    // Update optimistically so the dropdown feels instant; roll back on failure.
    setContractors((prev) =>
      prev ? prev.map((c) => (c.id === contractor.id ? { ...c, verificationStatus } : c)) : prev
    );

    try {
      const res = await fetch(`/api/admin/contractors/${contractor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? 'Failed to update status');
        setContractors((prev) =>
          prev ? prev.map((c) => (c.id === contractor.id ? { ...c, verificationStatus: previous } : c)) : prev
        );
      }
    } catch {
      alert('Failed to update status. Please try again.');
      setContractors((prev) =>
        prev ? prev.map((c) => (c.id === contractor.id ? { ...c, verificationStatus: previous } : c)) : prev
      );
    }
  }

  async function handleTierChange(contractor: ContractorRow, tier: ContractorRow['tier']) {
    const previous = contractor.tier;
    setContractors((prev) =>
      prev ? prev.map((c) => (c.id === contractor.id ? { ...c, tier } : c)) : prev
    );

    try {
      const res = await fetch(`/api/admin/contractors/${contractor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? 'Failed to update tier');
        setContractors((prev) =>
          prev ? prev.map((c) => (c.id === contractor.id ? { ...c, tier: previous } : c)) : prev
        );
      }
    } catch {
      alert('Failed to update tier. Please try again.');
      setContractors((prev) =>
        prev ? prev.map((c) => (c.id === contractor.id ? { ...c, tier: previous } : c)) : prev
      );
    }
  }

  return (
    <main className="min-h-screen bg-paper py-10 px-6">
      <div className="max-w-4xl mx-auto">
        <AdminTabs active="contractors" />
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display font-bold text-2xl tracking-tight">Contractors</h1>
          <div className="flex gap-3">
            <Link href="/admin/contractors/new" className="text-sm font-medium text-sage">
              + Add contractor
            </Link>
            <Link href="/browse" className="text-sm text-stone hover:text-ink">
              View live site →
            </Link>
          </div>
        </div>
        <p className="text-stone text-sm mb-8">
          {contractors ? `${contractors.length} contractor${contractors.length === 1 ? '' : 's'} total` : 'Loading…'}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-4 mb-6">
            {error}
          </div>
        )}

        {!error && contractors && contractors.length === 0 && (
          <div className="border border-line rounded-md p-10 text-center bg-white">
            <p className="text-stone font-medium mb-1">No contractors yet</p>
            <Link href="/admin/contractors/new" className="text-sm text-sage font-medium">
              Add your first one →
            </Link>
          </div>
        )}

        {contractors && contractors.length > 0 && (
          <div className="bg-white border border-line rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[11px] tracking-wider uppercase text-stone">
                  <th className="px-4 py-3 border-b border-line">Name</th>
                  <th className="px-4 py-3 border-b border-line">Email</th>
                  <th className="px-4 py-3 border-b border-line">Location</th>
                  <th className="px-4 py-3 border-b border-line">Status</th>
                  <th className="px-4 py-3 border-b border-line">Tier</th>
                  <th className="px-4 py-3 border-b border-line">Projects</th>
                  <th className="px-4 py-3 border-b border-line">Quotes</th>
                  <th className="px-4 py-3 border-b border-line"></th>
                </tr>
              </thead>
              <tbody>
                {contractors.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-4">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-stone font-mono">{c.licenseNumber}</div>
                    </td>
                    <td className="px-4 py-4 text-stone text-xs">{c.email}</td>
                    <td className="px-4 py-4 text-stone">{c.area}, {c.city}</td>
                    <td className="px-4 py-4">
                      <select
                        value={c.verificationStatus}
                        onChange={(e) =>
                          handleStatusChange(c, e.target.value as ContractorRow['verificationStatus'])
                        }
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border-0 cursor-pointer ${statusStyle[c.verificationStatus]}`}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="VERIFIED">VERIFIED</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={c.tier}
                        onChange={(e) => handleTierChange(c, e.target.value as ContractorRow['tier'])}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-line cursor-pointer bg-paper-dim"
                      >
                        <option value="LISTED">LISTED</option>
                        <option value="PLUS">PLUS</option>
                        <option value="PRO">PRO</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 text-stone">{c._count.projects}</td>
                    <td className="px-4 py-4 text-stone">{c._count.quoteRequests}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={deletingId === c.id}
                        className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {deletingId === c.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
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
