// Sets this section's browser-tab title ("Sign up as a developer | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign up as a developer',
  description: 'Find verified contractors, message them, visit their finished sites and request quotes.',
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
