// src/components/MessagesInbox.tsx
//
// The list half of Messages: every conversation the signed-in developer or
// contractor is part of, newest activity first (the server sorts; see
// GET /api/conversations). One row per QuoteRequest thread, whether it
// started as a quote request or as a developer's direct question from a
// contractor's profile ("enquiry").
//
// Before this screen existed, threads lived inline on each dashboard row,
// so a reply meant hunting for the right quote request and expanding it.
// A single inbox is what people expect from a phone app, and it's where
// the Nav's message icon now points.
//
// Polling: re-fetches every POLL_MS while the tab is visible and catches
// up the moment it becomes visible again, the same rules as
// useUnreadMessages. Loading the list doesn't mark anything read (only
// opening a conversation does), so polling here is harmless.
//
// Locked rows: a contractor over their free lead cap can see that a
// conversation exists but not read it, so the row is muted, isn't a link
// to the thread, and points at /pricing instead. The server 404s the
// thread itself for them, so this is presentation, not the lock.
//
// Relative times ("3h") are computed against `now`, captured when each
// response arrives rather than during render (see MessagesTime.tsx).

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Skeleton from '@/components/Skeleton';
import MessagesAvatar from '@/components/MessagesAvatar';
import { formatRelativeShort } from '@/components/MessagesTime';

const POLL_MS = 20_000;

export type ConversationRow = {
  id: string;
  kind: 'QUOTE' | 'ENQUIRY';
  title: string;
  otherParty: { name: string; slug: string | null; logoUrl: string | null };
  lastMessage: { body: string; createdAt: string; fromMe: boolean } | null;
  unread: number;
  locked: boolean;
  lastActivityAt: string;
};

function InboxSkeleton() {
  return (
    <div role="status" className="flex flex-col">
      <span className="sr-only">Loading…</span>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3.5 py-4 border-b border-line">
          <Skeleton className="w-11 h-11 rounded-full shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-full max-w-[320px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RowBody({ c, now }: { c: ConversationRow; now: number }) {
  const hasUnread = c.unread > 0 && !c.locked;
  const time = formatRelativeShort(c.lastMessage?.createdAt ?? c.lastActivityAt, now);
  const preview = c.locked
    ? 'Locked lead. Upgrade to read.'
    : c.lastMessage
      ? `${c.lastMessage.fromMe ? 'You: ' : ''}${c.lastMessage.body}`
      : 'No messages yet';

  return (
    <>
      <MessagesAvatar name={c.otherParty.name} logoUrl={c.otherParty.logoUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className={`truncate text-[15px] ${hasUnread ? 'font-semibold text-ink' : 'text-ink'}`}>
            {c.otherParty.name}
          </span>
          {time && (
            <span className={`shrink-0 text-xs ${hasUnread ? 'text-ink font-medium' : 'text-stone'}`}>{time}</span>
          )}
        </div>
        <div className="truncate text-[12.5px] text-stone mt-0.5">
          {c.kind === 'ENQUIRY' && (
            <span className="inline-block mr-1.5 px-1.5 py-px rounded-full bg-paper-dim text-[10.5px] text-stone align-[1px]">
              Enquiry
            </span>
          )}
          {c.title}
        </div>
        <div className="flex items-center justify-between gap-3 mt-1">
          <span
            className={`truncate text-[13.5px] ${
              c.locked ? 'text-stone italic' : hasUnread ? 'text-ink font-medium' : 'text-stone'
            }`}
          >
            {c.locked && (
              <span aria-hidden="true" className="not-italic mr-1">
                🔒
              </span>
            )}
            {preview}
          </span>
          {hasUnread && (
            <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-ink text-paper text-[11px] font-semibold">
              {c.unread > 99 ? '99+' : c.unread}
              <span className="sr-only"> unread</span>
            </span>
          )}
        </div>
      </div>
    </>
  );
}

export default function MessagesInbox({ viewerRole }: { viewerRole: 'DEVELOPER' | 'CONTRACTOR' }) {
  const [rows, setRows] = useState<ConversationRow[] | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) {
        // Only surface an error if there's nothing on screen yet; a failed
        // background poll shouldn't replace a list that's already showing.
        if (!loadedRef.current) setError(true);
        return;
      }
      const data: { conversations: ConversationRow[] } = await res.json();
      loadedRef.current = true;
      setRows(data.conversations ?? []);
      setNow(Date.now());
      setError(false);
    } catch {
      if (!loadedRef.current) setError(true);
    }
  }, []);

  useEffect(() => {
    // 0ms timer rather than an inline call: setting state synchronously in
    // an effect is a lint error in this repo (react-hooks/set-state-in-effect).
    const first = setTimeout(load, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  if (rows === null) {
    if (error) {
      return (
        <div className="py-10">
          <p className="text-sm text-danger mb-3">Couldn&apos;t load your messages.</p>
          <button
            onClick={() => {
              setError(false);
              load();
            }}
            className="text-sm px-5 py-2.5 rounded-full border border-line hover:border-ink transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return <InboxSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <div className="border border-line rounded-[6px] px-5 py-10 text-center">
        <span aria-hidden="true" className="block text-2xl mb-3">
          💬
        </span>
        {viewerRole === 'DEVELOPER' ? (
          <>
            <p className="text-sm text-stone max-w-[360px] mx-auto mb-5">
              No conversations yet. Open a contractor&apos;s profile and tap Message to ask a question.
            </p>
            <Link
              href="/browse"
              className="inline-flex items-center justify-center text-sm px-5 py-2.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
            >
              Browse Contractors
            </Link>
          </>
        ) : (
          <p className="text-sm text-stone max-w-[360px] mx-auto">
            No messages yet. Developers&apos; questions and quote conversations will appear here.
          </p>
        )}
      </div>
    );
  }

  return (
    <ul className="flex flex-col border-t border-line">
      {rows.map((c) => (
        <li key={c.id} className="border-b border-line">
          {c.locked ? (
            <Link
              href="/pricing"
              className="flex items-start gap-3.5 py-4 px-1 opacity-70 hover:opacity-100 transition-opacity"
              aria-label={`${c.otherParty.name}, ${c.title}. Locked lead. Upgrade to read.`}
            >
              <RowBody c={c} now={now} />
            </Link>
          ) : (
            <Link
              href={`/messages/${c.id}`}
              className="flex items-start gap-3.5 py-4 px-1 hover:bg-paper-dim/60 transition-colors rounded-[4px]"
            >
              <RowBody c={c} now={now} />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
