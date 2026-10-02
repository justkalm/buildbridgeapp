// Sets this section's browser-tab title ("List your business | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'List your business',
  description: 'List your contracting business on (kalm) and get enquiries from developers.',
};

export default function ContractorSignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
