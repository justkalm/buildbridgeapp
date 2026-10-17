// Sets this section's browser-tab title ("Verify your email | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';
import { NEVER_INDEX } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Verify your email',
  robots: NEVER_INDEX,
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
