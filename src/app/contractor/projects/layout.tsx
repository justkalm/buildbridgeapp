// Sets this section's browser-tab title ("Manage projects | (kalm)"). The page itself
// is a client component, which can't set it.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Manage projects',
};

export default function ContractorProjectsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
