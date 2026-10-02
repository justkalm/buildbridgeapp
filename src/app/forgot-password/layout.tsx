// Sets this section's browser-tab title ("Forgot password | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Forgot password',
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
