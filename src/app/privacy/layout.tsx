// Sets this section's browser-tab title ("Privacy | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy',
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
