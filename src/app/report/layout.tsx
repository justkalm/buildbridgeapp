// Sets this page's browser-tab title ("Report content | (kalm)"). The page
// itself is a client component, which can't set it.
import type { Metadata } from 'next';
import { NEVER_INDEX } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Report content',
  robots: NEVER_INDEX,
};

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
