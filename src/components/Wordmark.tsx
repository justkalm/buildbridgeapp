// src/components/Wordmark.tsx
//
// The (kalm) wordmark, drawn to match the logo: thin geometric letters with
// wide spacing, between two tall, sweeping brackets. The brackets are drawn
// as curves (not typed characters) because the logo's are about 1.5 times the
// height of the letters, taller than any font's own parentheses. Everything is
// sized in em, so it scales with whatever font-size the caller sets.
//
// The letters use the Jost face (see layout.tsx) at a weight between Light and
// Regular. Brackets are decorative, so screen readers hear "kalm".

function Bracket({ side }: { side: 'left' | 'right' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 100"
      className="inline-block shrink-0"
      style={{ width: '0.264em', height: '1.1em', overflow: 'visible' }}
      fill="none"
      stroke="currentColor"
      strokeWidth="5.4"
      strokeLinecap="butt"
    >
      {side === 'left' ? <path d="M21 0 C 3 22, 3 78, 21 100" /> : <path d="M3 0 C 21 22, 21 78, 3 100" />}
    </svg>
  );
}

export default function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center font-logo text-ink leading-none ${className}`} style={{ fontWeight: 350 }}>
      <Bracket side="left" />
      <span className="px-[0.34em] tracking-[0.2em] -mr-[0.2em]">kalm</span>
      <Bracket side="right" />
    </span>
  );
}
