// src/components/MessagesComposer.tsx
//
// The message box pinned to the bottom of a conversation.
//
// Enter behaviour differs by device, on purpose:
//   - with a mouse/trackpad (desktop), Enter sends and Shift+Enter adds a
//     new line, like every desktop chat app;
//   - on a touch screen, Enter adds a new line and the Send button sends.
//     Phone keyboards have no comfortable Shift+Enter, and an accidental
//     send of a half-written quote message is worse than a tap.
// The check (`pointer: coarse`) runs at key-press time, not once on
// mount, so a tablet that gains a keyboard, or a laptop with a
// touchscreen switching modes, behaves correctly without a reload.
// While an IME is composing (Hindi/Marathi phonetic keyboards, for
// example), Enter confirms the word and must never send.
//
// The textarea grows with its content up to MAX_LINES, then scrolls. The
// height is set directly on the DOM node in an effect (no state), which
// is the cheapest way to keep it in step with every keystroke.
//
// Sending: the parent's onSend does the POST and resolves to an error
// string or null. The text is only cleared once the server has accepted
// it, so a failure (rate limit, network) never loses what was typed. The
// textarea goes read-only rather than disabled while sending: disabling
// it would drop focus and close the phone keyboard mid-conversation.

'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export const MAX_MESSAGE_LENGTH = 2000;
// Show the counter once someone is within this many characters of the limit.
const COUNTER_FROM = 1800;
const MAX_LINES = 5;
const LINE_HEIGHT_PX = 22;

export default function MessagesComposer({
  onSend,
}: {
  onSend: (body: string) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = LINE_HEIGHT_PX * MAX_LINES + 20; // + vertical padding
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [draft]);

  const trimmed = draft.trim();
  const tooLong = draft.length > MAX_MESSAGE_LENGTH;
  const canSend = trimmed.length > 0 && !tooLong && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    const err = await onSend(trimmed);
    setSending(false);
    if (err) {
      setError(err);
    } else {
      setDraft('');
      ref.current?.focus();
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    if (touch) return; // new line on phones; the Send button sends
    e.preventDefault();
    send();
  }

  return (
    <form
      className="border-t border-line bg-paper px-3 sm:px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <div className="flex items-end gap-2">
        <label htmlFor="message-composer" className="sr-only">
          Write a message
        </label>
        <textarea
          id="message-composer"
          ref={ref}
          rows={1}
          value={draft}
          readOnly={sending}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
          placeholder="Write a message…"
          aria-invalid={tooLong || undefined}
          aria-describedby={error ? 'message-composer-error' : undefined}
          className="flex-1 resize-none text-[15px] leading-[22px] px-4 py-[9px] border border-line rounded-[20px] bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={sending ? 'Sending message' : 'Send message'}
          className="shrink-0 h-10 px-5 rounded-full bg-ink text-paper text-sm font-medium hover:bg-stone transition-colors disabled:opacity-50 disabled:hover:bg-ink"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {(draft.length >= COUNTER_FROM || error) && (
        <div className="flex items-start justify-between gap-3 mt-1.5 px-1">
          {error ? (
            <p id="message-composer-error" role="alert" className="text-[12px] text-danger">
              {error}
            </p>
          ) : (
            <span />
          )}
          {draft.length >= COUNTER_FROM && (
            <span
              className={`shrink-0 text-[11.5px] tabular-nums ${tooLong ? 'text-danger font-medium' : 'text-stone'}`}
              aria-live="polite"
            >
              {draft.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
      )}
    </form>
  );
}
