// src/components/MessageThread.tsx
//
// Optional in-app conversation on a quote request — additive to the
// existing email/phone reveal shown alongside it on both dashboards, not
// a replacement. `viewerRole` tells this component which side it's
// rendering for, purely for alignment/styling (own messages right-
// aligned, the other party's left-aligned) — the actual authorization
// happens server-side in the API route, this prop has no security
// meaning.

'use client';

import { useEffect, useRef, useState } from 'react';

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
}: {
  quoteRequestId: string;
  viewerRole: 'DEVELOPER' | 'CONTRACTOR';
  // When the parent already provides its own expand/collapse control
  // (e.g. a "Message" button in a table row that shows/hides this whole
  // component), pass startOpen so this doesn't ALSO render its own
  // redundant "Message in-app" toggle inside an already-expanded space.
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [messages, setMessages] = useState<MessageRow[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/quote-requests/${quoteRequestId}/messages`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setMessages);
  }, [open, quoteRequestId]);

  useEffect(() => {
    if (messages) bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');

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
              <p className="text-xs text-stone">No messages yet — say hello.</p>
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
              onKeyDown={(e) => e.key === 'Enter' && send()}
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
        </>
      )}
    </div>
  );
}
