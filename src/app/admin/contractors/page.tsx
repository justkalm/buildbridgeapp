// src/app/admin/contractors/page.tsx
//
// Lists every contractor (verified or not) for admin management, with a
// delete action per row and an editable verification-status dropdown.
// Deleting is a real, permanent operation — it cascades to that
// contractor's Projects and QuoteRequests (see the DELETE route's
// comment) — so the confirmation step here explicitly shows the
// quote-request count before deleting, rather than a generic "are you
// sure?" that hides what's actually about to be lost.
//
// The VERIFIED option is disabled (with a title saying why) for any row the
// PATCH route would refuse anyway: a placeholder license, and/or a blank
// city or area. Rows with no location show "No location" in red. Admin
// can't fix location from here; the contractor adds it in their profile.

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminTabs from '@/components/AdminTabs';
import { isPlaceholderLicense } from '@/lib/license';
import { formatLocation } from '@/lib/location';
import { whatsappLink } from '@/lib/whatsapp';

type ContractorRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  // Private admin note (KALM-239). Admin eyes only.
  adminNote: string | null;
  createdAt: string;
  reverifyRequestedAt: string | null;
  city: string;
  area: string;
  tradeTypes: string[];
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  tier: 'LISTED' | 'PLUS' | 'PRO';
  licenseNumber: string;
  // A Verified contractor changed a checked detail and is waiting for a
  // re-check (they stay listed as "Verified · update in review").
  reverifyPending: boolean;
  reverifyFields: string[];
  // Verification progress (KALM-211): when each check was ticked, or null.
  checkDocumentsAt: string | null;
  checkGstinAt: string | null;
  checkContactAt: string | null;
  _count: { projects: number; quoteRequests: number };
};

// Admin-facing names for the fields in reverifyFields (the keys match
// CREDENTIAL_FIELDS in src/app/api/contractors/me/route.ts).
const REVERIFY_FIELD_LABELS: Record<string, string> = {
  city: 'city',
  area: 'area',
  phone: 'phone',
  gstRegistered: 'GST registration',
  tradeTypes: 'trades',
};

type ProjectRow = {
  id: string;
  title: string;
  developerName: string | null;
  reviewRating: number | null;
  reviewText: string | null;
  reviewedAt: string | null;
};

const statusStyle: Record<ContractorRow['verificationStatus'], string> = {
  VERIFIED: 'bg-sage-soft text-sage',
  PENDING: 'bg-paper-dim text-stone',
  REJECTED: 'bg-danger-soft text-danger',
};

// Verification desk (KALM-239): filter chips and sort options.
type DeskFilter = 'ALL' | 'PENDING' | 'READY' | 'RECHECK' | 'VERIFIED' | 'REJECTED';
type DeskSort = 'WAITING' | 'NEWEST' | 'NAME' | 'CHECKS';

const FILTER_LABELS: Record<DeskFilter, string> = {
  ALL: 'All',
  PENDING: 'Pending',
  READY: 'Ready to verify',
  RECHECK: 'Re-check',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function checksDone(c: ContractorRow): number {
  return [c.checkDocumentsAt, c.checkGstinAt, c.checkContactAt].filter(Boolean).length;
}

// All three checks ticked but still Pending: just needs the status flipped.
function isReady(c: ContractorRow): boolean {
  return c.verificationStatus === 'PENDING' && checksDone(c) === 3;
}

// When this contractor started waiting on admin: signup for a Pending
// contractor, the edit that triggered it for a re-check, otherwise null.
function waitingSince(c: ContractorRow): number | null {
  if (c.reverifyPending) return new Date(c.reverifyRequestedAt ?? c.createdAt).getTime();
  if (c.verificationStatus === 'PENDING') return new Date(c.createdAt).getTime();
  return null;
}

function matchesFilter(c: ContractorRow, filter: DeskFilter): boolean {
  switch (filter) {
    case 'ALL':
      return true;
    case 'PENDING':
      return c.verificationStatus === 'PENDING';
    case 'READY':
      return isReady(c);
    case 'RECHECK':
      return c.reverifyPending;
    case 'VERIFIED':
      return c.verificationStatus === 'VERIFIED';
    case 'REJECTED':
      return c.verificationStatus === 'REJECTED';
  }
}

function matchesSearch(c: ContractorRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  // Phone numbers are typed with spaces and dashes; match on digits too.
  const qDigits = q.replace(/\D/g, '');
  return (
    [c.name, c.email, c.licenseNumber, c.area, c.city, c.adminNote ?? ''].some((v) =>
      v.toLowerCase().includes(q)
    ) ||
    (qDigits.length >= 3 && c.phone.replace(/\D/g, '').includes(qDigits))
  );
}

function sortRows(rows: ContractorRow[], sort: DeskSort): ContractorRow[] {
  const copy = [...rows];
  switch (sort) {
    case 'WAITING':
      // People waiting on admin first, longest wait at the top; everyone
      // else after, newest signup first.
      return copy.sort((a, b) => {
        const wa = waitingSince(a);
        const wb = waitingSince(b);
        if (wa !== null && wb !== null) return wa - wb;
        if (wa !== null) return -1;
        if (wb !== null) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    case 'NEWEST':
      return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'NAME':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'CHECKS':
      return copy.sort((a, b) => checksDone(b) - checksDone(a) || a.name.localeCompare(b.name));
  }
}

export default function AdminContractorsPage() {
  const [contractors, setContractors] = useState<ContractorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedContractorId, setExpandedContractorId] = useState<string | null>(null);
  const [projectsByContractor, setProjectsByContractor] = useState<Record<string, ProjectRow[]>>({});
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [ratingDraft, setRatingDraft] = useState(5);
  const [textDraft, setTextDraft] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  // Verification desk (KALM-239)
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DeskFilter>('ALL');
  const [sort, setSort] = useState<DeskSort>('WAITING');
  // "Now" is read once when the page opens, so the waiting-days figures stay
  // steady while the page is drawn; reloading the page refreshes them.
  const [now] = useState(() => Date.now());
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  function openNote(contractor: ContractorRow) {
    if (noteOpenId === contractor.id) {
      setNoteOpenId(null);
      return;
    }
    setNoteOpenId(contractor.id);
    setNoteDraft(contractor.adminNote ?? '');
  }

  async function saveNote(contractor: ContractorRow) {
    setSavingNote(true);
    try {
      const res = await fetch(`/api/admin/contractors/${contractor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNote: noteDraft }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error ?? 'Failed to save the note');
        return;
      }
      setContractors((prev) =>
        prev ? prev.map((c) => (c.id === contractor.id ? { ...c, adminNote: data.contractor.adminNote } : c)) : prev
      );
      setNoteOpenId(null);
    } catch {
      alert('Failed to save the note. Please try again.');
    } finally {
      setSavingNote(false);
    }
  }

  async function toggleExpand(contractorId: string) {
    if (expandedContractorId === contractorId) {
      setExpandedContractorId(null);
      return;
    }
    setExpandedContractorId(contractorId);
    if (!projectsByContractor[contractorId]) {
      const res = await fetch(`/api/admin/contractors/${contractorId}/projects`);
      if (res.ok) {
        const projects = await res.json();
        setProjectsByContractor((prev) => ({ ...prev, [contractorId]: projects }));
      }
    }
  }

  function startReview(project: ProjectRow) {
    setEditingProjectId(project.id);
    setRatingDraft(project.reviewRating ?? 5);
    setTextDraft(project.reviewText ?? '');
  }

  async function saveReview(contractorId: string, projectId: string) {
    setSavingReview(true);
    const res = await fetch(`/api/admin/projects/${projectId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: ratingDraft, text: textDraft.trim() || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProjectsByContractor((prev) => ({
        ...prev,
        [contractorId]: prev[contractorId].map((p) => (p.id === projectId ? { ...p, ...updated } : p)),
      }));
      setEditingProjectId(null);
    } else {
      alert('Failed to save review. Please try again.');
    }
    setSavingReview(false);
  }

  async function clearReview(contractorId: string, projectId: string) {
    if (!confirm('Remove this review?')) return;
    const res = await fetch(`/api/admin/projects/${projectId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProjectsByContractor((prev) => ({
        ...prev,
        [contractorId]: prev[contractorId].map((p) => (p.id === projectId ? { ...p, ...updated } : p)),
      }));
    }
  }

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
    // Setting any status also answers a pending re-check (see the PATCH route).
    setContractors((prev) =>
      prev
        ? prev.map((c) =>
            c.id === contractor.id ? { ...c, verificationStatus, reverifyPending: false, reverifyFields: [] } : c
          )
        : prev
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

  // Record or correct a contractor's license number. Mostly for
  // self-signed-up contractors, who start with a placeholder and can't be
  // marked Verified until the real number is on file. The server drops an
  // already-Verified contractor back to PENDING if their license changes,
  // so the row is replaced with the server's copy rather than patched
  // optimistically.
  // The contractor's changed details check out: clear the "update in
  // review" note and re-stamp their verification date.
  async function handleConfirmReverify(contractor: ContractorRow) {
    try {
      const res = await fetch(`/api/admin/contractors/${contractor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmReverification: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error ?? 'Failed to confirm');
        return;
      }
      setContractors((prev) =>
        prev ? prev.map((c) => (c.id === contractor.id ? { ...c, ...data.contractor } : c)) : prev
      );
    } catch {
      alert('Failed to confirm. Please try again.');
    }
  }

  async function handleLicenseEdit(contractor: ContractorRow) {
    const current = isPlaceholderLicense(contractor.licenseNumber) ? '' : contractor.licenseNumber;
    const input = window.prompt(`License number for ${contractor.name}:`, current);
    if (input === null) return;
    const licenseNumber = input.trim();
    if (!licenseNumber || licenseNumber === contractor.licenseNumber) return;

    try {
      const res = await fetch(`/api/admin/contractors/${contractor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseNumber }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error ?? 'Failed to update license number');
        return;
      }
      setContractors((prev) =>
        prev ? prev.map((c) => (c.id === contractor.id ? { ...c, ...data.contractor } : c)) : prev
      );
    } catch {
      alert('Failed to update license number. Please try again.');
    }
  }

  // KALM-211: tick or untick one of the three checks. Informational only; it
  // never changes the Verified status.
  async function handleCheckToggle(
    contractor: ContractorRow,
    key: 'documents' | 'gstin' | 'contact',
    column: 'checkDocumentsAt' | 'checkGstinAt' | 'checkContactAt',
    done: boolean
  ) {
    const previous = contractor[column];
    const stamp = done ? new Date().toISOString() : null;
    setContractors((prev) => (prev ? prev.map((c) => (c.id === contractor.id ? { ...c, [column]: stamp } : c)) : prev));
    try {
      const res = await fetch(`/api/admin/contractors/${contractor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checks: { [key]: done } }),
      });
      if (!res.ok) throw new Error();
    } catch {
      alert('Failed to update the check. Please try again.');
      setContractors((prev) => (prev ? prev.map((c) => (c.id === contractor.id ? { ...c, [column]: previous } : c)) : prev));
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

  const visibleContractors = contractors
    ? sortRows(
        contractors.filter((c) => matchesFilter(c, filter) && matchesSearch(c, query)),
        sort
      )
    : [];
  const filterCounts = (f: DeskFilter) => (contractors ? contractors.filter((c) => matchesFilter(c, f)).length : 0);

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
          {contractors
            ? visibleContractors.length === contractors.length
              ? `${contractors.length} contractor${contractors.length === 1 ? '' : 's'} total`
              : `Showing ${visibleContractors.length} of ${contractors.length}`
            : 'Loading…'}
        </p>

        {error && (
          <div className="bg-danger-soft border border-danger/30 text-danger text-sm rounded-md p-4 mb-6">
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
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, phone, area, note"
                aria-label="Search contractors"
                className="flex-1 min-w-[220px] text-sm px-3 py-2 border border-line rounded-[4px] bg-white focus:outline-none focus:ring-2 focus:ring-ink"
              />
              <label className="flex items-center gap-2 text-xs text-stone">
                Sort
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as DeskSort)}
                  className="text-sm px-2 py-2 border border-line rounded-[4px] bg-white text-ink"
                >
                  <option value="WAITING">Longest waiting first</option>
                  <option value="NEWEST">Newest signup</option>
                  <option value="CHECKS">Most checks done</option>
                  <option value="NAME">Name A to Z</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              {(Object.keys(FILTER_LABELS) as DeskFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    filter === f ? 'bg-ink text-paper border-ink' : 'bg-white text-stone border-line hover:text-ink'
                  }`}
                >
                  {FILTER_LABELS[f]} <span className="opacity-70">{filterCounts(f)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {contractors && contractors.length > 0 && visibleContractors.length === 0 && (
          <div className="border border-line rounded-md p-10 text-center bg-white">
            <p className="text-stone font-medium mb-1">Nobody matches that</p>
            <button
              onClick={() => {
                setQuery('');
                setFilter('ALL');
              }}
              className="text-sm text-sage font-medium"
            >
              Clear search and filter
            </button>
          </div>
        )}

        {contractors && visibleContractors.length > 0 && (
          <div className="bg-white border border-line rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
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
                {visibleContractors.map((c) => {
                  const waitStart = waitingSince(c);
                  const waitDays = waitStart === null ? null : Math.max(0, Math.floor((now - waitStart) / DAY_MS));
                  const waLink = whatsappLink(c.phone);
                  const placeholderLicense = isPlaceholderLicense(c.licenseNumber);
                  const missingLocation = !c.city.trim() || !c.area.trim();
                  // Every reason VERIFIED is blocked for this row, joined
                  // into one tooltip so both show when both apply.
                  const verifyBlockers = [
                    placeholderLicense &&
                      'no real license number on file (self-signup placeholder), so add their real license',
                    missingLocation &&
                      'no location on file, so they need to add their city and area in their profile',
                    c.verificationStatus !== 'VERIFIED' &&
                      !(c.checkDocumentsAt && c.checkGstinAt && c.checkContactAt) &&
                      'tick all three checks (Documents, GSTIN, Spoke to them)',
                  ].filter(Boolean);
                  const verifyBlockedTitle =
                    verifyBlockers.length > 0
                      ? `Can't mark Verified yet: ${verifyBlockers.join('; and ')}.`
                      : undefined;
                  return (
                  <React.Fragment key={c.id}>
                  <tr className="border-b border-line last:border-b-0">
                    <td className="px-4 py-4">
                      <div className="font-medium">{c.name}</div>
                      {waitDays !== null && (
                        <div className={`text-[11px] ${waitDays >= 7 ? 'text-danger font-medium' : 'text-stone'}`}>
                          {c.reverifyPending ? 'Re-check' : 'Pending'}: waiting {waitDays === 0 ? 'since today' : `${waitDays} day${waitDays === 1 ? '' : 's'}`}
                        </div>
                      )}
                      {placeholderLicense ? (
                        <div className="text-xs text-danger font-medium">
                          No license on file{' '}
                          <button
                            onClick={() => handleLicenseEdit(c)}
                            className="underline underline-offset-2 hover:text-ink"
                          >
                            Add license
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-stone font-mono">
                          {c.licenseNumber}{' '}
                          <button
                            onClick={() => handleLicenseEdit(c)}
                            className="font-sans underline underline-offset-2 hover:text-ink"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-stone text-xs">
                      <div>{c.email}</div>
                      <div className="mt-0.5">
                        {c.phone}
                        {waLink && (
                          <>
                            {' '}
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-sage underline underline-offset-2"
                            >
                              WhatsApp
                            </a>
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => openNote(c)}
                        aria-expanded={noteOpenId === c.id}
                        className="mt-1 underline underline-offset-2 hover:text-ink"
                      >
                        {c.adminNote ? 'Note ●' : 'Add note'}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-stone">
                      {missingLocation ? (
                        <span
                          className="text-xs text-danger font-medium"
                          title="City or area is blank. The contractor adds it in their profile."
                        >
                          No location
                        </span>
                      ) : (
                        formatLocation(c.area, c.city)
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={c.verificationStatus}
                        onChange={(e) =>
                          handleStatusChange(c, e.target.value as ContractorRow['verificationStatus'])
                        }
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border-0 cursor-pointer ${statusStyle[c.verificationStatus]}`}
                      >
                        <option value="PENDING">PENDING</option>
                        <option
                          value="VERIFIED"
                          disabled={verifyBlockers.length > 0}
                          title={verifyBlockedTitle}
                        >
                          VERIFIED
                        </option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                      {c.verificationStatus === 'PENDING' && (
                        <div className="mt-1.5 flex flex-col gap-0.5 text-[11px] text-stone">
                          {(
                            [
                              ['documents', 'checkDocumentsAt', 'Documents'],
                              ['gstin', 'checkGstinAt', 'GSTIN'],
                              ['contact', 'checkContactAt', 'Spoke to them'],
                            ] as const
                          ).map(([key, column, label]) => (
                            <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!c[column]}
                                onChange={(e) => handleCheckToggle(c, key, column, e.target.checked)}
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      )}
                      {c.reverifyPending && (
                        <div className="mt-1.5 text-[11px] leading-snug">
                          <p className="text-danger font-medium">
                            Re-check:{' '}
                            {c.reverifyFields.map((f) => REVERIFY_FIELD_LABELS[f] ?? f).join(', ') || 'details'} changed
                          </p>
                          <button
                            onClick={() => handleConfirmReverify(c)}
                            className="underline underline-offset-2 text-stone hover:text-ink"
                          >
                            Confirm, still verified
                          </button>
                        </div>
                      )}
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
                    <td className="px-4 py-4 text-stone">
                      <button
                        onClick={() => toggleExpand(c.id)}
                        className="underline underline-offset-2 hover:text-ink transition-colors"
                      >
                        {c._count.projects}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-stone">{c._count.quoteRequests}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={deletingId === c.id}
                        className="text-xs font-medium text-danger hover:text-ink disabled:opacity-50"
                      >
                        {deletingId === c.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                  {noteOpenId === c.id && (
                    <tr className="border-b border-line last:border-b-0 bg-paper-dim/40">
                      <td colSpan={8} className="px-4 py-4">
                        <label className="block text-xs text-stone mb-1" htmlFor={`note-${c.id}`}>
                          Private note about {c.name}. Only admins see this.
                        </label>
                        <textarea
                          id={`note-${c.id}`}
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          rows={3}
                          maxLength={2000}
                          placeholder="e.g. Spoke on 8 Oct, sending GST papers tomorrow"
                          className="w-full text-sm px-3 py-2 border border-line rounded-[4px] bg-white focus:outline-none focus:ring-2 focus:ring-ink"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => saveNote(c)}
                            disabled={savingNote}
                            className="text-xs font-medium px-3 py-1.5 rounded-full bg-ink text-paper disabled:opacity-60"
                          >
                            {savingNote ? 'Saving…' : 'Save note'}
                          </button>
                          <button
                            onClick={() => setNoteOpenId(null)}
                            className="text-xs font-medium px-3 py-1.5 rounded-full border border-line"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {expandedContractorId === c.id && (
                    <tr className="border-b border-line last:border-b-0 bg-paper-dim/40">
                      <td colSpan={8} className="px-4 py-4">
                        {!projectsByContractor[c.id] ? (
                          <p className="text-xs text-stone">Loading projects…</p>
                        ) : projectsByContractor[c.id].length === 0 ? (
                          <p className="text-xs text-stone">No projects yet.</p>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {projectsByContractor[c.id].map((p) => (
                              <div key={p.id} className="bg-white border border-line rounded-md p-3">
                                <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                                  <div>
                                    <p className="text-sm font-medium">{p.title}</p>
                                    <p className="text-xs text-stone">
                                      {p.developerName || 'N/A'}
                                    </p>
                                  </div>
                                  {p.reviewRating ? (
                                    <div className="flex gap-2 items-center">
                                      <span className="text-sage text-sm" aria-label={`${p.reviewRating} out of 5 stars`} role="img">{'★'.repeat(p.reviewRating)}</span>
                                      <button
                                        onClick={() => startReview(p)}
                                        className="text-xs text-stone hover:text-ink underline underline-offset-2"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => clearReview(c.id, p.id)}
                                        className="text-xs text-stone hover:text-danger underline underline-offset-2"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => startReview(p)}
                                      className="text-xs font-medium text-sage underline underline-offset-2"
                                    >
                                      + Add review
                                    </button>
                                  )}
                                </div>

                                {editingProjectId === p.id ? (
                                  <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-line">
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs text-stone">Rating:</label>
                                      <select
                                        value={ratingDraft}
                                        onChange={(e) => setRatingDraft(Number(e.target.value))}
                                        className="text-xs px-2 py-1 rounded border border-line"
                                      >
                                        {[5, 4, 3, 2, 1].map((n) => (
                                          <option key={n} value={n}>{n} star{n === 1 ? '' : 's'}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <textarea
                                      value={textDraft}
                                      onChange={(e) => setTextDraft(e.target.value)}
                                      rows={2}
                                      placeholder="What the developer said, in their own words"
                                      className="text-sm px-3 py-2 border border-line rounded-[4px] focus:outline-none focus:ring-2 focus:ring-ink"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => saveReview(c.id, p.id)}
                                        disabled={savingReview}
                                        className="text-xs font-medium px-3 py-1.5 rounded-full bg-ink text-paper disabled:opacity-60"
                                      >
                                        {savingReview ? 'Saving…' : 'Save review'}
                                      </button>
                                      <button
                                        onClick={() => setEditingProjectId(null)}
                                        className="text-xs font-medium px-3 py-1.5 rounded-full border border-line"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  p.reviewText && (
                                    <p className="text-xs text-stone italic mt-1">&quot;{p.reviewText}&quot;</p>
                                  )
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
