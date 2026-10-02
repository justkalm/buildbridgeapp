// Sets this section's browser-tab title ("Pricing | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Plans for contractors listing on (kalm).',
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
