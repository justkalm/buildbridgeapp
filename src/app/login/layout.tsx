// Sets this section's browser-tab title ("Sign in | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';
import { NEVER_INDEX } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: NEVER_INDEX,
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
