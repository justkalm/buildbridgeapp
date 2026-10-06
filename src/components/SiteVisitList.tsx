// src/components/SiteVisitList.tsx
//
// "Site visits" section, shared by both dashboards. `viewerRole` decides
// the wording and which buttons appear:
//   - contractor, on a new request: pick one of the offered times, say
//     where to meet, and confirm; or decline with an optional reason;
//   - either side, on an open or upcoming visit: cancel;
//   - either side, once confirmed: "Add to calendar" (downloads the same
//     .ics the confirmation email attaches).
// The server re-checks every one of these (src/app/api/site-visits/[id]),
// so hiding a button here is about a clean UI, not security.
//
// Renders nothing until loaded, and nothing at all for a contractor with
// no visits, so it doesn't add an empty box to every dashboard. Has
// id="site-visits" so the links in the visit emails land right on it.
//
// Each card has a "Message {other party}" button. Developers start or
// reopen a conversation through ProfileMessageButton (compose dialog when
// there is none yet); contractors can't start one, so they only get a link,
// and only when /api/site-visits/mine reports a conversationId.
//
// Cards the other side has changed since you last looked get a "New"
// label. Loading this list marks them seen server-side, so it then tells
// the Nav badge to refresh.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ProfileMessageButton from '@/components/ProfileMessageButton';
import { announceNotificationsChanged } from '@/lib/use-unread-messages';
import {
  contractorVisitStatusLabel,
  developerVisitStatusLabel,
  formatVisitTime,
  type SiteVisitStatus,
} from '@/lib/site-visits';

type Visit = {
  id: string;
  status: SiteVisitStatus;
  sites: string[];
  proposedSlots: string[];
  confirmedSlot: string | null;
  developerNote: string | null;
  contactPhone: string | null;
  // Contractor side only: a request past the free plan's five leads a month.
  // Its contact details are removed and it cannot be answered until upgrade.
  locked?: boolean;
  meetingPoint: string | null;
  responseNote: string | null;
  cancelledBy: 'DEVELOPER' | 'CONTRACTOR' | null;
  createdAt: string;
  isNew: boolean;
  contractorId: string;
  // Latest conversation between the two, or null (contractors can only
  // message into an existing one).
  conversationId: string | null;
  contractor: { name: string; slug: string; phone: string | null };
  developer: { name: string; email?: string };
};

const statusStyle: Record<SiteVisitStatus, string> = {
  REQUESTED: 'bg-paper-dim text-stone',
  CONFIRMED: 'bg-sage-soft text-sage',
  DECLINED: 'bg-paper-dim text-stone',
  CANCELLED: 'bg-paper-dim text-stone',
};

const inputCls =
  'w-full text-sm px-3 py-2 border border-line rounded-[4px] bg-paper focus:outline-none focus:ring-2 focus:ring-ink';

// `inTab`: rendered inside the contractor dashboard's "Site visits" tab,
// where the tab is the heading, so the section title is dropped and an
// empty list says so instead of the section disappearing.
export default function SiteVisitList({
  viewerRole,
  inTab = false,
}: {
  viewerRole: 'DEVELOPER' | 'CONTRACTOR';
  inTab?: boolean;
}) {
  const [visits, setVisits] = useState<Visit[] | null>(null);
  // "Now" as of the last load, used to tell upcoming visits from past
  // ones. Captured when data arrives rather than read during render, so
  // rendering stays pure (and the answer can't flicker between renders).
  const [loadedAt, setLoadedAt] = useState(0);
  const isContractor = viewerRole === 'CONTRACTOR';

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/site-visits/mine');
      if (res.ok) {
        const rows: Visit[] = await res.json();
        setVisits(rows);
        setLoadedAt(Date.now());
        if (rows.some((r) => r.isNew)) announceNotificationsChanged();
      }
    } catch {
      // Leave whatever is showing; the next action or reload will retry.
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (!visits) return null;
  if (visits.length === 0 && isContractor && !inTab) return null;

  // KALM-178: visits still in play (waiting for an answer, or confirmed
  // and still ahead) come first; declined, cancelled and already-happened
  // ones fold into "Past visits" so they stop taking up the list. Anything
  // the viewer hasn't seen yet (e.g. just cancelled by the other side)
  // stays up top until they have.
  const isCurrent = (v: Visit) =>
    v.isNew ||
    v.status === 'REQUESTED' ||
    (v.status === 'CONFIRMED' && !!v.confirmedSlot && new Date(v.confirmedSlot).getTime() > loadedAt);
  const current = visits.filter(isCurrent);
  const past = visits.filter((v) => !isCurrent(v));

  return (
    <section id="site-visits" className={`${inTab ? '' : 'mb-10'} scroll-mt-24`}>
      {!inTab && <h2 className="font-display font-light text-xl mb-1">Site visits</h2>}
      <p className="text-stone text-xs mb-4">
        {isContractor
          ? 'Developers who want to see your completed projects in person.'
          : 'Visits you have asked for to see contractors’ completed work in person.'}
      </p>
      {visits.length === 0 ? (
        <p className="text-sm text-stone border border-line rounded-md p-5 bg-paper">
          {isContractor
            ? 'No site visits yet. When a developer asks to see your projects, it shows up here.'
            : <>No site visits yet. Open a contractor&apos;s profile and choose &quot;Schedule a site visit&quot; to see their work in person.</>}
        </p>
      ) : (
        <>
          {current.length === 0 ? (
            <p className="text-sm text-stone">No upcoming site visits.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {current.map((v) => (
                <VisitCard key={v.id} visit={v} isContractor={isContractor} now={loadedAt} onChanged={load} />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <details className="mt-4 group">
              <summary className="text-sm text-stone cursor-pointer hover:text-ink select-none">
                Past visits ({past.length})
              </summary>
              <div className="flex flex-col gap-3 mt-3">
                {past.map((v) => (
                  <VisitCard key={v.id} visit={v} isContractor={isContractor} now={loadedAt} onChanged={load} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function VisitCard({
  visit: v,
  isContractor,
  now,
  onChanged,
}: {
  visit: Visit;
  isContractor: boolean;
  now: number;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<'idle' | 'confirming'>('idle');
  const [slot, setSlot] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = isContractor ? contractorVisitStatusLabel[v.status] : developerVisitStatusLabel[v.status];
  const upcoming = v.status === 'CONFIRMED' && v.confirmedSlot && new Date(v.confirmedSlot).getTime() > now;
  const canCancel = v.status === 'REQUESTED' || upcoming;

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/site-visits/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setMode('idle');
        onChanged();
      } else {
        setError(data?.error ?? "Couldn't update this visit. Please try again.");
      }
    } catch {
      setError("Couldn't reach the server. Please check your connection and try again.");
    }
    setBusy(false);
  }

  function decline() {
    const reason = window.prompt(
      `Decline ${v.developer.name}'s visit request? They'll be emailed. Add a reason (optional):`,
      ''
    );
    if (reason === null) return;
    act({ action: 'decline', note: reason.trim() || undefined });
  }

  function cancel() {
    const reason = window.prompt(
      `Cancel this site visit? ${isContractor ? v.developer.name : v.contractor.name} will be emailed. Add a note (optional):`,
      ''
    );
    if (reason === null) return;
    act({ action: 'cancel', note: reason.trim() || undefined });
  }

  const otherParty = isContractor ? (
    <span className="font-medium text-sm">{v.developer.name}</span>
  ) : (
    <Link href={`/contractors/${v.contractor.slug}`} className="font-medium text-sm hover:text-stone transition-colors">
      {v.contractor.name}
    </Link>
  );

  return (
    <div
      className={`border rounded-[6px] p-4 bg-paper ${
        v.isNew || (v.status === 'REQUESTED' && isContractor) ? 'border-ink' : 'border-line'
      }`}
    >
      <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
        <div>
          {otherParty}
          <p className="text-stone text-xs mt-0.5">
            {v.sites.length} site{v.sites.length === 1 ? '' : 's'}: {v.sites.join(', ') || 'N/A'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {v.isNew && (
            <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-ink text-paper">New</span>
          )}
          <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${statusStyle[v.status]}`}>{label}</span>
        </div>
      </div>

      {v.status === 'CONFIRMED' && v.confirmedSlot && (
        <div className="text-sm mb-2">
          <p className="font-medium">{formatVisitTime(v.confirmedSlot)}</p>
          {v.meetingPoint && <p className="text-stone whitespace-pre-wrap">Meet at: {v.meetingPoint}</p>}
          <p className="text-xs text-stone mt-1">
            {isContractor
              ? v.contactPhone && `Developer's phone: ${v.contactPhone}${v.developer.email ? ` · ${v.developer.email}` : ''}`
              : v.contractor.phone && `Contractor's phone: ${v.contractor.phone}`}
          </p>
          {upcoming && (
            <a
              href={`/api/site-visits/${v.id}/calendar`}
              className="inline-block text-xs mt-2 underline underline-offset-2 text-stone hover:text-ink"
            >
              Add to calendar
            </a>
          )}
        </div>
      )}

      {v.status === 'REQUESTED' && (
        <div className="text-sm mb-2">
          <p className="text-xs text-stone mb-1">{isContractor ? 'Times they offered:' : 'Times you offered:'}</p>
          <ul className="text-sm list-disc pl-5">
            {v.proposedSlots.map((s) => (
              <li key={s}>{formatVisitTime(s)}</li>
            ))}
          </ul>
          {isContractor && !v.locked && v.contactPhone && (
            <p className="text-xs text-stone mt-1">
              Phone: {v.contactPhone}
              {v.developer.email ? ` · ${v.developer.email}` : ''}
            </p>
          )}
          {isContractor && v.locked && (
            <p className="text-xs text-stone mt-2 border border-line rounded-[4px] bg-paper-dim px-3 py-2">
              This request is past the free leads on your plan this month, so the developer&apos;s contact details are
              hidden and it can&apos;t be answered yet.{' '}
              <Link href="/pricing" className="underline underline-offset-2 text-ink">
                See plans
              </Link>
            </p>
          )}
        </div>
      )}

      {v.developerNote && (
        <p className="text-xs text-stone mb-2">
          {isContractor ? 'Their note' : 'Your note'}: {v.developerNote}
        </p>
      )}
      {v.responseNote && v.status !== 'REQUESTED' && (
        <p className="text-xs text-stone mb-2">
          {v.status === 'CANCELLED' ? 'Cancellation note' : isContractor ? 'Your note' : 'Contractor’s note'}:{' '}
          {v.responseNote}
        </p>
      )}
      {v.status === 'CANCELLED' && v.cancelledBy && (
        <p className="text-xs text-stone mb-2">
          Cancelled by {(v.cancelledBy === 'CONTRACTOR') === isContractor ? 'you' : isContractor ? 'the developer' : 'the contractor'}.
        </p>
      )}

      {isContractor && v.status === 'REQUESTED' && mode === 'confirming' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!slot) {
              setError('Please pick one of the times.');
              return;
            }
            act({ action: 'confirm', slot, meetingPoint, note: note.trim() || undefined });
          }}
          className="border-t border-line pt-3 mt-3 flex flex-col gap-3"
        >
          <fieldset>
            <legend className="text-sm font-medium mb-1.5">Which time works?</legend>
            {v.proposedSlots.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                <input type="radio" name={`slot-${v.id}`} value={s} checked={slot === s} onChange={() => setSlot(s)} />
                {formatVisitTime(s)}
              </label>
            ))}
          </fieldset>
          <div>
            <label className="block text-sm font-medium mb-1.5">Where should they meet you?</label>
            <textarea
              required
              minLength={3}
              maxLength={500}
              rows={2}
              value={meetingPoint}
              onChange={(e) => setMeetingPoint(e.target.value)}
              placeholder="Site address or meeting point, e.g. Main gate, Sunrise Towers, Thane West"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Anything else? <span className="text-stone font-normal">(optional)</span>
            </label>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={inputCls} />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="text-xs px-4 py-2 rounded-full bg-ink text-paper hover:bg-stone transition-colors disabled:opacity-60"
            >
              {busy ? 'Confirming…' : 'Confirm visit'}
            </button>
            <button
              type="button"
              onClick={() => setMode('idle')}
              className="text-xs px-4 py-2 rounded-full border border-line text-stone hover:border-ink"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {mode === 'idle' && !v.locked && (isContractor && v.status === 'REQUESTED' ? true : canCancel) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {isContractor && v.status === 'REQUESTED' && (
            <>
              <button
                onClick={() => setMode('confirming')}
                disabled={busy}
                className="text-xs px-4 py-1.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors disabled:opacity-60"
              >
                Pick a time
              </button>
              <button
                onClick={decline}
                disabled={busy}
                className="text-xs px-4 py-1.5 rounded-full border border-line text-stone hover:border-danger hover:text-danger transition-colors disabled:opacity-60"
              >
                Decline
              </button>
            </>
          )}
          {canCancel && !(isContractor && v.status === 'REQUESTED') && (
            <button
              onClick={cancel}
              disabled={busy}
              className="text-xs px-4 py-1.5 rounded-full border border-line text-stone hover:border-danger hover:text-danger transition-colors disabled:opacity-60"
            >
              Cancel visit
            </button>
          )}
        </div>
      )}

      {(!isContractor || v.conversationId) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {isContractor ? (
            <Link
              href={`/messages/${v.conversationId}`}
              className="text-xs px-4 py-1.5 rounded-full border border-line text-ink hover:border-ink transition-colors"
            >
              Message {v.developer.name}
            </Link>
          ) : (
            <ProfileMessageButton
              contractorId={v.contractorId}
              contractorName={v.contractor.name}
              label={`Message ${v.contractor.name}`}
              className="text-xs px-4 py-1.5 rounded-full border border-line text-ink hover:border-ink transition-colors disabled:opacity-60"
            />
          )}
        </div>
      )}

      {error && <p className="text-[11px] text-danger mt-2">{error}</p>}
    </div>
  );
}
