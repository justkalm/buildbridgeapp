// Sets the browser-tab title and link preview text for /join, the
// contractor onboarding form the team sends on WhatsApp or email. Kept out
// of search results: it is meant to be reached from a link we send.
import type { Metadata } from 'next';
import { NEVER_INDEX } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Join (kalm)',
  description: 'Send us your business details and project photos, and we will set up your (kalm) listing.',
  robots: NEVER_INDEX,
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
