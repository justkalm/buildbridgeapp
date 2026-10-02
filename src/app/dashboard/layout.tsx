// Sets this section's browser-tab title ("Your dashboard | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your dashboard',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
