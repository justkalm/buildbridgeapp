// src/components/ProfileMessageButton.tsx
//
// "Message" entry point into in-app messaging, used on a contractor's
// profile (header and sidebar) and on each developer site visit card.
//
// Why it works in two steps: POST /api/conversations with just
// { contractorId } either finds a conversation the developer already has
// with this contractor (200 { id, existing: true }, so we go straight to
// /messages/{id}) or answers 400 BODY_REQUIRED, meaning there is nothing to
// reopen and a first message is needed. Only then do we show a small
// compose dialog and POST again with { contractorId, body }. That way a
// developer never has to type a message just to get back to a thread.
//
// Who sees it is decided by the caller (developers only; logged-out
// visitors get a plain link to /login, see ProfileMessageLoginLink at the
// bottom). The server re-checks the role, and EMAIL_NOT_VERIFIED errors
// link to /dashboard where the verification email can be resent.
//
// The dialog: Escape and Cancel close it, focus moves to the textarea on
// open and returns to the button on close, Tab is kept inside the dialog.

'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type ApiError = { message: string; code?: string };

const MAX_LEN = 2000;

export default function ProfileMessageButton({
  contractorId,
  contractorName,
  label = 'Message',
  className,
}: {
  contractorId: string;
  contractorName: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState('');
  // Error from the first (no body) attempt shows next to the button; errors
  // from sending show inside the dialog.
  const [error, setError] = useState<ApiError | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  async function post(payload: { contractorId: string; body?: string }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: { id?: string; error?: string; code?: string } | null = await res.json().catch(() => null);
      if (res.ok && data?.id) {
        router.push(`/messages/${data.id}`);
        return; // keep busy until the navigation lands
      }
      if (data?.code === 'BODY_REQUIRED' && payload.body === undefined) {
        setComposing(true);
      } else {
        setError({ message: data?.error ?? 'Something went wrong. Please try again.', code: data?.code });
      }
    } catch {
      setError({ message: 'Could not reach the server. Please check your connection and try again.' });
    }
    setBusy(false);
  }

  function close() {
    setComposing(false);
    setError(null);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }

  useEffect(() => {
    if (composing) textareaRef.current?.focus();
  }, [composing]);

  function onDialogKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('textarea, button:not(:disabled), a[href]');
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    post({ contractorId, body: text });
  }

  const errorBlock = (err: ApiError) => (
    <div role="alert" className="text-sm text-danger">
      <p>{err.message}</p>
      {err.code === 'EMAIL_NOT_VERIFIED' && (
        <Link href="/dashboard" className="underline underline-offset-2 font-medium">
          Go to your dashboard to resend verification
        </Link>
      )}
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => post({ contractorId })}
        disabled={busy}
        className={className ?? 'text-sm px-4 py-2.5 rounded-full border border-line text-ink hover:border-ink transition-colors disabled:opacity-60'}
      >
        {busy && !composing ? 'Opening…' : label}
      </button>
      {!composing && error && <div className="mt-2 basis-full">{errorBlock(error)}</div>}

      {composing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={onDialogKeyDown}
            className="w-full max-w-md bg-paper border border-line rounded-md p-5 text-ink"
          >
            <form onSubmit={send} className="flex flex-col gap-3">
              <label id={titleId} htmlFor={`${titleId}-body`} className="font-display text-[15.5px]">
                Ask {contractorName} a question
              </label>
              <textarea
                id={`${titleId}-body`}
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={MAX_LEN}
                rows={5}
                required
                className="w-full px-3 py-2.5 border border-line rounded-[4px] text-[13.5px] bg-paper resize-y focus:outline-none focus:ring-2 focus:ring-ink"
              />
              <p className="text-[11.5px] text-stone text-right">
                {body.length} / {MAX_LEN}
              </p>
              {error && errorBlock(error)}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={close}
                  className="text-sm px-4 py-2 rounded-full border border-line text-stone hover:border-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || body.trim().length === 0}
                  className="text-sm px-5 py-2 rounded-full bg-ink text-paper hover:bg-stone transition-colors disabled:opacity-60"
                >
                  {busy ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
