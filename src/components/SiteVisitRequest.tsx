// src/components/SiteVisitRequest.tsx
//
// "See their work in person" panel on a contractor's public profile. A
// developer ticks which of the contractor's completed projects they want
// to visit, offers three date/time options, and sends. The contractor is
// emailed and answers from their dashboard (see
// src/app/api/site-visits/route.ts for every rule the server enforces;
// this form mirrors them so mistakes are caught before sending, but the
// server is the real check).
//
// Collapsed by default so it doesn't push the project gallery down for
// people who are just browsing. Who sees what:
//   - signed-in developer: the button and form;
//   - logged-out visitor: a prompt to sign in as a developer;
//   - contractor viewer, or a contractor who can't receive requests
//     (unclaimed account, no projects listed): the parent doesn't render
//     this at all.
//
// Times use <input type="datetime-local">, which is in the developer's own
// clock (IST for this market). They're converted to UTC ISO strings
// before sending; everything is shown back in India time.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MAX_SITES, MIN_NOTICE_MS, SLOT_COUNT, minSitesFor } from '@/lib/site-visits';

type ProjectOption = { id: string; title: string };

// datetime-local wants "YYYY-MM-DDTHH:mm" in LOCAL time, not UTC.
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputCls =
  'w-full text-sm px-3 py-2.5 border border-line rounded-[4px] bg-paper focus:outline-none focus:ring-2 focus:ring-ink';

export default function SiteVisitRequest({
  contractorId,
  contractorName,
  projects,
  isDeveloper,
}: {
  contractorId: string;
  contractorName: string;
  projects: ProjectOption[];
  isDeveloper: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>(Array(SLOT_COUNT).fill(''));
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [sent, setSent] = useState(false);
  // Computed once when the form opens, not on every render, so the
  // "earliest allowed" time doesn't drift while someone is filling it in.
  const [minValue, setMinValue] = useState('');

  const minSites = minSitesFor(projects.length);
  const maxSites = Math.min(MAX_SITES, projects.length);

  if (!isDeveloper) {
    return (
      <div className="border border-line rounded-md p-5 bg-paper mb-6">
        <p className="font-medium text-sm mb-1">See their work in person</p>
        <p className="text-sm text-stone">
          <Link href="/login" className="underline underline-offset-2 hover:text-ink">
            Sign in as a developer
          </Link>{' '}
          to schedule a visit to {contractorName}&apos;s completed sites.
        </p>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="border border-sage/40 bg-sage-soft rounded-md p-5 mb-6">
        <p className="font-medium text-sm mb-1">Visit request sent</p>
        <p className="text-sm text-stone">
          We&apos;ve emailed {contractorName}. You&apos;ll get an email when they pick a time, and you can follow it
          on your{' '}
          <Link href="/dashboard#site-visits" className="underline underline-offset-2 hover:text-ink">
            dashboard
          </Link>
          .
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="border border-line rounded-md p-5 bg-paper mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-sm mb-1">See their work in person</p>
          <p className="text-sm text-stone">
            Pick {minSites === maxSites ? minSites : `${minSites} to ${maxSites}`} of these sites and offer three times
            that suit you.
          </p>
        </div>
        <button
          onClick={() => {
            setMinValue(toLocalInputValue(new Date(Date.now() + MIN_NOTICE_MS)));
            setOpen(true);
          }}
          className="text-sm px-5 py-2.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
        >
          Schedule a site visit
        </button>
      </div>
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxSites) return prev;
      return [...prev, id];
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selected.length < minSites) {
      setError({ message: `Please pick at least ${minSites} site${minSites === 1 ? '' : 's'}.` });
      return;
    }
    if (slots.some((s) => !s)) {
      setError({ message: `Please offer ${SLOT_COUNT} times.` });
      return;
    }
    const isoSlots = slots.map((s) => new Date(s).toISOString());
    if (new Set(isoSlots).size !== SLOT_COUNT) {
      setError({ message: `Please offer ${SLOT_COUNT} different times.` });
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/site-visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractorId,
          projectIds: selected,
          slots: isoSlots,
          contactPhone: phone,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setSent(true);
      } else {
        setError({ message: data?.error ?? "Couldn't send the request. Please try again.", code: data?.code });
      }
    } catch {
      setError({ message: "Couldn't reach the server. Please check your connection and try again." });
    }
    setSending(false);
  }

  return (
    <form onSubmit={submit} className="border border-ink rounded-md p-5 bg-paper mb-6">
      <div className="flex justify-between items-start gap-3 mb-4">
        <div>
          <p className="font-medium text-sm mb-1">Schedule a site visit</p>
          <p className="text-xs text-stone">
            {contractorName} will pick one of your times and tell you where to meet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-stone underline underline-offset-2 hover:text-ink"
        >
          Close
        </button>
      </div>

      <fieldset className="mb-5">
        <legend className="text-sm font-medium mb-2">
          Which sites? <span className="text-stone font-normal">({selected.length} of {maxSites} max, at least {minSites})</span>
        </legend>
        <div className="flex flex-col gap-1.5">
          {projects.map((p) => {
            const checked = selected.includes(p.id);
            const disabled = !checked && selected.length >= maxSites;
            return (
              <label
                key={p.id}
                className={`flex items-center gap-3 text-sm px-3 py-2 rounded-[4px] border ${
                  checked ? 'border-ink bg-paper-dim' : 'border-line'
                } ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
              >
                <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(p.id)} />
                <span className="flex-1">{p.title}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mb-5">
        <legend className="text-sm font-medium mb-2">Three times that suit you</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {slots.map((value, i) => (
            <input
              key={i}
              type="datetime-local"
              required
              min={minValue}
              value={value}
              aria-label={`Option ${i + 1}`}
              onChange={(e) => setSlots((prev) => prev.map((s, j) => (j === i ? e.target.value : s)))}
              className={inputCls}
            />
          ))}
        </div>
        <p className="text-xs text-stone mt-1.5">At least 12 hours from now, within the next 90 days.</p>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">Your phone for the day</label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Note <span className="text-stone font-normal">(optional)</span>
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="e.g. Coming with our site engineer"
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="text-sm text-danger mb-3">
          <p>{error.message}</p>
          {error.code === 'EMAIL_NOT_VERIFIED' && (
            <Link href="/dashboard" className="underline underline-offset-2 font-medium">
              Go to your dashboard to resend verification
            </Link>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={sending}
        className="text-sm px-6 py-2.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors disabled:opacity-60"
      >
        {sending ? 'Sending…' : 'Send visit request'}
      </button>
    </form>
  );
}
