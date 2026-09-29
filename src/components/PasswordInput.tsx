// src/components/PasswordInput.tsx
//
// A password box with a "Show" / "Hide" button inside its right edge, so
// people can check what they typed. Especially useful now that passwords
// must be 10+ characters, and on phones where typos are easy and each
// character is only shown for a moment. Used by every password field in
// the app (login, both signups, reset, admin login) so they all behave
// the same.
//
// Takes the same props as a normal <input> (value, onChange, required,
// minLength, className…); only `type` is managed here. The toggle is a
// real button with aria-pressed and a spoken label ("Show password" /
// "Hide password") so screen-reader and keyboard users get it too. It's
// type="button" so pressing it never submits the form, and it keeps the
// text cursor in the box so typing can carry on.

'use client';

import { useRef, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export default function PasswordInput({ className = '', ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <input
        {...props}
        ref={inputRef}
        type={visible ? 'text' : 'password'}
        // Keep the typed text clear of the Show/Hide button.
        className={`${className} pr-16`}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => {
          setVisible((v) => !v);
          inputRef.current?.focus();
        }}
        // Stop the button taking focus on mouse/tap so the caret stays put.
        onMouseDown={(e) => e.preventDefault()}
        aria-pressed={visible}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-stone hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded-r-[4px]"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
