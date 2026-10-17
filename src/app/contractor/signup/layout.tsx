// Sets this section's browser-tab title ("List your business | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';
import { NEVER_INDEX, SEARCH_ENGINES_ALLOWED } from '@/lib/site';

export const metadata: Metadata = {
  title: 'List your business',
  description: 'List your contracting business on (kalm) and get enquiries from developers.',
  // The contractor section is kept out of search (contractor/layout.tsx),
  // but this page is how contractors find us, so it follows the site-wide
  // switch like the other public pages.
  robots: SEARCH_ENGINES_ALLOWED ? { index: true, follow: true } : NEVER_INDEX,
};

export default function ContractorSignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
