// Sets this section's browser-tab title ("Verify your email | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify your email',
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
