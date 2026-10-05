// src/components/MessagesConversation.tsx
//
// One conversation (a QuoteRequest thread): header, the scrolling message
// log, and the composer. Replaces the small inline MessageThread that used
// to sit inside dashboard rows; on a phone a 220px box inside a table row
// was nobody's idea of a chat.
//
// Layout: on phones this fills the screen under the Nav (100dvh minus the
// nav height, so the browser's own toolbar and the keyboard don't push the
// composer off screen), with only the message list scrolling. On desktop
// it's a bordered card in a centred column, same scrolling model, so the
// composer is always in reach without scrolling the page.
//
// Data, from three endpoints:
//   - GET /api/conversations/[id]: who the other party is, the quote
//     summary and status, and otherLastReadAt (for "Seen"). Re-fetched
//     every META_POLL_MS so a status change or a read receipt shows up.
//   - GET /api/quote-requests/[id]/messages: the messages, oldest first.
//     Polled every MESSAGES_POLL_MS while the tab is visible. Fetching
//     marks the thread read for the viewer server-side, which is exactly
//     why polling pauses while the tab is hidden: a message that lands in
//     a background tab hasn't been read, and shouldn't show as "Seen" to
//     the sender. Catches up as soon as the tab is visible again.
//   - POST to the same messages URL to send.
// Either GET returning 404 means "not a party, or a locked lead": the
// screen shows a friendly dead end rather than an error.
//
// Scrolling: the list jumps to the bottom on first load, and follows new
// messages only while the reader is already at (or near) the bottom. If
// they've scrolled up to read something older, a poll that brings a new
// message shows a "New messages" pill instead of yanking the view away.
// Sending always scrolls down: you want to see what you just sent.
//
// Races: a poll that was already in flight when a message was sent would
// come back without that message and briefly "unsend" it. Each load
// records how many sends had happened when it started and drops its
// result if another send has happened since; the next poll catches up.
//
// Dates ("Today", "10:42 am") are computed against `now`, captured when a
// load finishes rather than during render (see MessagesTime.tsx).

'use client';

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Skeleton from '@/components/Skeleton';
import MessagesAvatar from '@/components/MessagesAvatar';
import ReportLink from '@/components/ReportLink';
import MessagesComposer from '@/components/MessagesComposer';
import { dayKey, formatClock, formatDayLabel } from '@/components/MessagesTime';
import { announceNotificationsChanged } from '@/lib/use-unread-messages';
import { contractorStatusLabel, developerStatusLabel, type QuoteStatus } from '@/lib/quote-status';

const MESSAGES_POLL_MS = 5_000;
const META_POLL_MS = 30_000;
// How close to the bottom (px) still counts as "at the bottom".
const STICKY_BOTTOM_PX = 80;

type Role = 'DEVELOPER' | 'CONTRACTOR';

type Meta = {
  id: string;
  kind: 'QUOTE' | 'ENQUIRY';
  title: string;
  viewerRole: Role;
  otherParty: { name: string; slug: string | null; logoUrl: string | null };
  quote: { projectType: string; location: string; budgetRangeLabel: string; status: QuoteStatus } | null;
  otherLastReadAt: string | null;
};

type Message = { id: string; senderRole: Role; body: string; createdAt: string };

const statusStyle: Record<QuoteStatus, string> = {
  PENDING: 'bg-paper-dim text-stone',
  CONTACTED: 'bg-sage-soft text-sage',
  QUOTED: 'bg-ink text-paper',
  DECLINED: 'bg-paper-dim text-stone line-through decoration-stone/40',
};

// Same shell for the loading, error and unavailable states, so the screen
// doesn't change shape when the real content arrives.
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-[760px] mx-auto flex flex-col h-[calc(100dvh-var(--nav-h))] md:h-[min(780px,calc(100dvh-var(--nav-h)-4rem))] md:my-8 md:border md:border-line md:rounded-[6px] bg-paper overflow-hidden">
      {children}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/messages"
      aria-label="Back to messages"
      className="shrink-0 -ml-1.5 w-9 h-9 inline-flex items-center justify-center rounded-full text-ink hover:bg-paper-dim transition-colors"
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </Link>
  );
}

function LoadingState() {
  return (
    <Shell>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
        <BackLink />
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div role="status" className="flex-1 px-4 py-6 flex flex-col gap-3">
        <span className="sr-only">Loading…</span>
        <Skeleton className="h-10 w-3/5 rounded-[14px]" />
        <Skeleton className="h-10 w-2/5 rounded-[14px] self-end" />
        <Skeleton className="h-16 w-3/5 rounded-[14px]" />
      </div>
    </Shell>
  );
}

function Unavailable() {
  return (
    <Shell>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
        <BackLink />
        <span className="text-[15px]">Messages</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <h1 className="font-display font-light text-[22px] mb-2">This conversation isn&apos;t available</h1>
        <p className="text-sm text-stone max-w-[340px] mb-6">
          It may have been removed, or it belongs to a different account.
        </p>
        <Link
          href="/messages"
          className="inline-flex items-center justify-center text-sm px-5 py-2.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
        >
          Back to messages
        </Link>
      </div>
    </Shell>
  );
}

export default function MessagesConversation({ id }: { id: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [now, setNow] = useState(0);
  const [showNewPill, setShowNewPill] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const pendingScrollRef = useRef<ScrollBehavior | null>(null);
  const messagesRef = useRef<Message[] | null>(null);
  const sendCountRef = useRef(0);
  const loadSeqRef = useRef(0);
  const viewerRoleRef = useRef<Role | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        if (!viewerRoleRef.current) setLoadError(true);
        return;
      }
      const data: Meta = await res.json();
      viewerRoleRef.current = data.viewerRole;
      setMeta(data);
      setLoadError(false);
    } catch {
      if (!viewerRoleRef.current) setLoadError(true);
    }
  }, [id]);

  const loadMessages = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    const sendsAtStart = sendCountRef.current;
    try {
      const res = await fetch(`/api/quote-requests/${id}/messages`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        if (!messagesRef.current) setLoadError(true);
        return;
      }
      const rows: Message[] = await res.json();
      // Stale: a newer load started, or a send happened, while this one was
      // in flight. Its list might be missing a message we already show.
      if (seq !== loadSeqRef.current || sendsAtStart !== sendCountRef.current) return;

      const prev = messagesRef.current;
      const prevIds = new Set((prev ?? []).map((m) => m.id));
      const added = rows.filter((m) => !prevIds.has(m.id));
      const role = viewerRoleRef.current;
      const addedIncoming = added.some((m) => m.senderRole !== role);

      if (prev === null) {
        pendingScrollRef.current = 'instant';
      } else if (added.length > 0) {
        if (atBottomRef.current) pendingScrollRef.current = 'smooth';
        else if (addedIncoming) setShowNewPill(true);
      }

      messagesRef.current = rows;
      setMessages(rows);
      setNow(Date.now());
      setLoadError(false);
      // This fetch just marked the thread read; let the Nav badge catch up.
      // Only when something actually changed, so a quiet thread polling
      // every few seconds doesn't make the Nav re-poll with it.
      if (prev === null || addedIncoming) announceNotificationsChanged();
    } catch {
      if (!messagesRef.current) setLoadError(true);
    }
  }, [id]);

  // Messages: first load, then poll while visible.
  useEffect(() => {
    // 0ms timers rather than inline calls: setting state synchronously in
    // an effect is a lint error in this repo (react-hooks/set-state-in-effect).
    const first = setTimeout(() => {
      loadMeta();
      loadMessages();
    }, 0);
    const msgTimer = setInterval(() => {
      if (document.visibilityState === 'visible') loadMessages();
    }, MESSAGES_POLL_MS);
    const metaTimer = setInterval(() => {
      if (document.visibilityState === 'visible') loadMeta();
    }, META_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadMessages();
        loadMeta();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(msgTimer);
      clearInterval(metaTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadMeta, loadMessages]);

  // Carry out a scroll that a load or send asked for, once the new
  // messages are actually in the DOM. Touches the DOM only, no state.
  useEffect(() => {
    const behavior = pendingScrollRef.current;
    const el = scrollRef.current;
    if (!behavior || !el) return;
    pendingScrollRef.current = null;
    el.scrollTo({ top: el.scrollHeight, behavior });
    atBottomRef.current = true;
  }, [messages, meta]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_BOTTOM_PX;
    atBottomRef.current = atBottom;
    if (atBottom && showNewPill) setShowNewPill(false);
  }

  function jumpToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setShowNewPill(false);
  }

  async function send(body: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/quote-requests/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (res.status === 404) return data?.error ?? "This conversation isn't available any more.";
        return data?.error ?? "Couldn't send. Please try again.";
      }
      const sent: Message = await res.json();
      sendCountRef.current += 1;
      const current = messagesRef.current ?? [];
      const next = current.some((m) => m.id === sent.id) ? current : [...current, sent];
      messagesRef.current = next;
      pendingScrollRef.current = 'smooth';
      setMessages(next);
      setNow(Date.now());
      setShowNewPill(false);
      return null;
    } catch {
      return "Couldn't send. Check your connection and try again.";
    }
  }

  if (notFound) return <Unavailable />;

  if (loadError && (!meta || !messages)) {
    return (
      <Shell>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <BackLink />
          <span className="text-[15px]">Messages</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <p className="text-sm text-danger mb-4">Couldn&apos;t load this conversation.</p>
          <button
            onClick={() => {
              setLoadError(false);
              loadMeta();
              loadMessages();
            }}
            className="text-sm px-5 py-2.5 rounded-full border border-line hover:border-ink transition-colors"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (!meta || !messages) return <LoadingState />;

  const viewerRole = meta.viewerRole;
  const statusLabel = meta.quote
    ? (viewerRole === 'DEVELOPER' ? developerStatusLabel : contractorStatusLabel)[meta.quote.status]
    : null;
  const profileHref =
    viewerRole === 'DEVELOPER' && meta.otherParty.slug ? `/contractors/${meta.otherParty.slug}` : null;

  // "Seen" goes under my most recent message, if the other side has read
  // up to (or past) it.
  let lastMineId: string | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].senderRole === viewerRole) {
      lastMineId = messages[i].id;
      break;
    }
  }
  const lastMine = lastMineId ? messages.find((m) => m.id === lastMineId) : null;
  const seen =
    !!lastMine &&
    !!meta.otherLastReadAt &&
    new Date(meta.otherLastReadAt).getTime() >= new Date(lastMine.createdAt).getTime();

  return (
    <Shell>
      {/* Header */}
      <header className="flex items-start gap-3 px-4 py-3 border-b border-line">
        <BackLink />
        <MessagesAvatar name={meta.otherParty.name} logoUrl={meta.otherParty.logoUrl} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <h1 className="truncate text-[15.5px] font-semibold text-ink">{meta.otherParty.name}</h1>
            {profileHref && (
              <Link
                href={profileHref}
                className="shrink-0 text-xs text-stone underline underline-offset-2 hover:text-ink transition-colors"
              >
                View profile
              </Link>
            )}
            <ReportLink type="MESSAGE" id={id} className="shrink-0" />
          </div>
          <p className="truncate text-[12.5px] text-stone">{meta.title}</p>
          {meta.quote && statusLabel && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
              <span className="text-[12px] text-stone truncate max-w-full">
                {meta.quote.projectType} · {meta.quote.location} · {meta.quote.budgetRangeLabel}
              </span>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] ${statusStyle[meta.quote.status]}`}>
                {statusLabel}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-label={`Conversation with ${meta.otherParty.name}`}
          className="h-full overflow-y-auto overscroll-contain px-4 py-4"
        >
          {messages.length === 0 ? (
            <p className="text-sm text-stone text-center mt-10">No messages yet. Say hello.</p>
          ) : (
            <ol className="flex flex-col">
              {messages.map((m, i) => {
                const prev = i > 0 ? messages[i - 1] : null;
                const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                const runStart = newDay || !prev || prev.senderRole !== m.senderRole;
                const mine = m.senderRole === viewerRole;
                return (
                  <Fragment key={m.id}>
                    {newDay && (
                      <li className="flex justify-center my-4">
                        <span className="text-[11.5px] text-stone px-3 py-1 rounded-full bg-paper-dim">
                          {formatDayLabel(m.createdAt, now)}
                        </span>
                      </li>
                    )}
                    <li className={`flex flex-col ${mine ? 'items-end' : 'items-start'} ${runStart ? 'mt-3' : 'mt-1'}`}>
                      {runStart && (
                        <span className="text-[11.5px] text-stone mb-1 px-1">
                          {mine ? 'You' : meta.otherParty.name}
                        </span>
                      )}
                      <div
                        className={`max-w-[82%] sm:max-w-[70%] px-3.5 py-2 text-[14.5px] leading-[1.45] whitespace-pre-wrap break-words ${
                          mine
                            ? 'bg-ink text-paper rounded-[16px] rounded-br-[4px]'
                            : 'bg-paper-dim text-ink rounded-[16px] rounded-bl-[4px]'
                        }`}
                      >
                        {m.body}
                      </div>
                      <span className="text-[10.5px] text-stone mt-1 px-1">
                        <time dateTime={m.createdAt}>{formatClock(m.createdAt)}</time>
                        {m.id === lastMineId && seen && <span> · Seen</span>}
                      </span>
                    </li>
                  </Fragment>
                );
              })}
            </ol>
          )}
        </div>

        {showNewPill && (
          <button
            onClick={jumpToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs font-medium px-4 py-2 rounded-full bg-ink text-paper shadow-md hover:bg-stone transition-colors"
          >
            New messages <span aria-hidden="true">↓</span>
          </button>
        )}
      </div>

      <MessagesComposer onSend={send} />
    </Shell>
  );
}
