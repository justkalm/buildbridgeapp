// src/components/LineIcons.tsx
//
// The few icons the site needs, drawn as thin lines in the same style as the
// speech bubble in the nav (24 by 24 box, 1.7 stroke, round ends, current
// text colour). They replace the colourful emoji that used to sit here, which
// clashed with the thin lettering of the wordmark. Decorative only: always
// hidden from screen readers, the words next to them carry the meaning.
// Metadata (location, trades, years) uses no icons at all, just type.

type IconProps = { size?: number; className?: string };

function Base({ size = 16, className = '', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export function ChatLineIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.55L3 20.5l1.5-5.1A8.5 8.5 0 1 1 21 11.5z" />
    </Base>
  );
}

export function LockLineIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Base>
  );
}
