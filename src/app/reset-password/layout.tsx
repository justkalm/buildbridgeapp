// Sets this section's browser-tab title ("Reset password | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset password',
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
