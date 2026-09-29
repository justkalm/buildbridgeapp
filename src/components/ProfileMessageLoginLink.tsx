// src/components/ProfileMessageLoginLink.tsx
//
// What a logged-out visitor sees in place of the "Message" button on a
// contractor profile: the same look, but a link to /login (messaging needs
// a developer account, and the login page is where they can also find
// sign-up).

import Link from 'next/link';

export default function ProfileMessageLoginLink({ className }: { className?: string }) {
  return (
    <Link
      href="/login"
      className={className ?? 'text-sm px-4 py-2.5 rounded-full border border-line text-ink hover:border-ink transition-colors'}
    >
      Message
    </Link>
  );
}
