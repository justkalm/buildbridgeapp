// Sets the browser-tab title and link preview text for /join, the
// contractor onboarding form the team sends on WhatsApp or email. Kept out
// of search results: it is meant to be reached from a link we send.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join (kalm)',
  description: 'Send us your business details and project photos, and we will set up your (kalm) listing.',
  robots: { index: false, follow: false },
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
