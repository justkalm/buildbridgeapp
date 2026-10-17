// Sets this section's browser-tab title ("Contractor dashboard | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';
import { NEVER_INDEX } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contractor dashboard',
  robots: NEVER_INDEX,
};

export default function ContractorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
