// Sets this section's browser-tab title ("Contact | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
