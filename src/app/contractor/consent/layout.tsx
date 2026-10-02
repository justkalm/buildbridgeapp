// Sets this section's browser-tab title ("Data sharing | (kalm)"). The page itself
// is a client component, which can't set it.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data sharing',
};

export default function ContractorConsentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
