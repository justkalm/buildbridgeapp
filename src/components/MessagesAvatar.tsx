// src/components/MessagesAvatar.tsx
//
// Round avatar for the other party in the Messages inbox and conversation
// header: their logo when they have one, otherwise their initials on a
// soft circle (developers never have a logo, and plenty of contractors
// haven't uploaded one yet).
//
// The logo goes through ProfileImage rather than next/image directly:
// logo URLs aren't all guaranteed to be on a host next.config.ts allows,
// and ProfileImage falls back to an unoptimised image instead of throwing,
// so one odd logo can't take down the whole inbox.
//
// Decorative: the name is always printed right next to it, so the image
// has empty alt text and the initials are aria-hidden. Repeating the name
// would only make screen readers say it twice.

import ProfileImage from '@/components/ProfileImage';

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0] ?? '';
  const second = words.length > 1 ? (words[words.length - 1][0] ?? '') : '';
  return (first + second).toUpperCase();
}

export default function MessagesAvatar({
  name,
  logoUrl,
  size = 44,
}: {
  name: string;
  logoUrl: string | null;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (logoUrl) {
    return (
      <span
        className="shrink-0 rounded-full overflow-hidden border border-line bg-paper inline-block"
        style={style}
      >
        <ProfileImage
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          className="w-full h-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-full bg-paper-dim text-stone border border-line inline-flex items-center justify-center font-medium"
      style={{ ...style, fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}
