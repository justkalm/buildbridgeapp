// src/components/AlertMessageButton.tsx
//
// "I'm interested, message {developer}" on a contractor's project alert.
// The one way a contractor can START a conversation: the developer posted
// the project asking to be connected, and admin chose this contractor (see
// POST /api/project-alerts/[id]/message). Opens a short intro box, sends
// it, then goes to the new conversation in Messages. If they've already
// messaged about this project, it's just an "Open conversation" link.

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AlertMessageButton({
  alertId,
  developerName,
  conversationId,
}: {
  alertId: string;
  developerName: string;
  conversationId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  if (conversationId) {
    return (
      <Link
        href={`/messages/${conversationId}`}
        className="inline-flex items-center text-xs font-medium px-4 py-2 rounded-full border border-line hover:border-ink transition-colors"
      >
        Open conversation
      </Link>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium px-4 py-2 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
      >
        I&apos;m interested, message {developerName}
      </button>
    );
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/project-alerts/${alertId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.id) {
        router.push(`/messages/${data.id}`);
        return;
      }
      setError(data?.error ?? "Couldn't send. Please try again.");
    } catch {
      setError("Couldn't reach the server. Please check your connection and try again.");
    }
    setSending(false);
  }

  return (
    <form onSubmit={send} className="w-full flex flex-col gap-2">
      <label htmlFor={`alert-msg-${alertId}`} className="text-xs font-medium">
        Introduce yourself to {developerName}
      </label>
      <textarea
        id={`alert-msg-${alertId}`}
        ref={textareaRef}
        rows={3}
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="e.g. We've completed 3 similar projects in this area and would be glad to discuss yours."
        className="w-full text-sm px-3 py-2 border border-line rounded-[4px] bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="text-xs font-medium px-4 py-2 rounded-full bg-ink text-paper disabled:opacity-60"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium px-4 py-2 rounded-full border border-line text-stone hover:border-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
