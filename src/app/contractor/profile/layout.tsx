// Sets this section's browser-tab title ("Edit profile | (kalm)"). The page itself
// is a client component, which can't set it.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit profile',
};

export default function ContractorProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
