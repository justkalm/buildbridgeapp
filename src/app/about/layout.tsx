// Sets this section's browser-tab title ("About | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
  description: 'Who is behind (kalm), and why we built it.',
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
