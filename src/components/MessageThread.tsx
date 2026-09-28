// src/components/MessageThread.tsx
//
// Optional in-app conversation on a quote request — additive to the
// existing email/phone reveal shown alongside it on both dashboards, not
// a replacement. `viewerRole` tells this component which side it's
// rendering for, purely for alignment/styling (own messages right-
// aligned, the other party's left-aligned) — the actual authorization
// happens server-side in the API route, this prop has no security
// meaning.
//
// While open, the thread re-fetches every POLL_MS so replies show up
// without a page reload. Polling pauses when the browser tab is hidden:
// fetching the thread marks it read server-side, and messages arriving in
// a background tab haven't really been read. It also saves requests for
// tabs left open all day. Proper push (websockets/SSE) isn't worth the
// infrastructure at this volume; a 15-second delay is fine for a
// quote conversation.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_MS = 15_000;

type MessageRow = {
  id: string;
  senderRole: 'DEVELOPER' | 'CONTRACTOR';
  body: string;
  createdAt: string;
};

export default function MessageThread({
  quoteRequestId,
  viewerRole,
  startOpen = false,
  onRead,
}: {
  quoteRequestId: string;
  viewerRole: 'DEVELOPER' | 'CONTRACTOR';
  // When the parent already provides its own expand/collapse control
  // (e.g. a "Message" button in a table row that shows/hides this whole
  // component), pass startOpen so this doesn't ALSO render its own
  // redundant "Message in-app" toggle inside an already-expanded space.
  startOpen?: boolean;
  // Called after each successful load of the thread (which marks it read
  // server-side), so the parent can clear this thread's unread badge
  // without waiting for its own next poll.
  onRead?: () => void;
}) {
  const [open, setOpen] = useState(startOpen);
  const [messages, setMessages] = useState<MessageRow[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/quote-requests/${quoteRequestId}/messages`);
      if (!res.ok) return;
      const rows: MessageRow[] = await res.json();
      setMessages(rows);
      onRead?.();
    } catch {
      // Network blip during a background poll: keep showing what we have
      // and try again on the next tick rather than blanking the thread.
    }
  }, [quoteRequestId, onRead]);

  useEffect(() => {
    if (!open) return;
    // The first load is scheduled rather than called inline: setting state
    // synchronously inside an effect is flagged by the repo's lint rules
    // (react-hooks/set-state-in-effect), and a 0ms timer sidesteps that.
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
  }, [open, load]);

  // Only auto-scroll when the number of messages actually changes, so a
  // poll that returns the same thread doesn't yank the view back down
  // while someone is scrolled up reading older messages.
  useEffect(() => {
    if (!messages || messages.length === lastCountRef.current) return;
    lastCountRef.current = messages.length;
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    setDraft('');

    try {
      const res = await fetch(`/api/quote-requests/${quoteRequestId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        const sent = await res.json();
        setMessages((prev) => (prev ? [...prev, sent] : [sent]));
      } else {
        setDraft(text); // put it back so nothing's lost on failure
        const data = await res.json().catch(() => null);
        setSendError(data?.error ?? "Couldn't send. Please try again.");
      }
    } catch {
      setDraft(text);
      setSendError("Couldn't send. Check your connection and try again.");
    }
    setSending(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-stone underline underline-offset-2 hover:text-ink transition-colors"
      >
        Message in-app
      </button>
    );
  }

  return (
    <div className="border-t border-line mt-2 pt-3">
      {!messages ? (
        <p className="text-xs text-stone">Loading…</p>
      ) : (
        <>
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto mb-2">
            {messages.length === 0 && (
              <p className="text-xs text-stone">No messages yet, say hello.</p>
            )}
            {messages.map((m) => {
              const isOwn = m.senderRole === viewerRole;
              return (
                <div
                  key={m.id}
                  className={`max-w-[80%] text-xs px-3 py-2 rounded-[10px] ${
                    isOwn ? 'self-end bg-ink text-paper' : 'self-start bg-paper-dim text-ink'
                  }`}
                >
                  {m.body}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              // isComposing: while typing with an IME (e.g. Hindi/Marathi
              // phonetic keyboards), Enter confirms the composed word; it
              // shouldn't also send a half-typed message.
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && send()}
              placeholder="Type a message…"
              className="flex-1 text-xs px-3 py-2 border border-line rounded-full focus:outline-none focus:ring-2 focus:ring-ink"
            />
            <button
              onClick={send}
              disabled={sending || !draft.trim()}
              className="text-xs font-medium px-4 py-2 rounded-full bg-ink text-paper disabled:opacity-60"
            >
              Send
            </button>
          </div>
          {sendError && <p className="text-[11px] text-red-600 mt-1.5">{sendError}</p>}
        </>
      )}
    </div>
  );
}
