// Sets this section's browser-tab title ("Find a contractor | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Find a contractor',
  description: 'Browse licensed, verified contractors by trade and area, and compare their completed projects.',
};

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
