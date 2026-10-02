// Sets this section's browser-tab title ("Post a project | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Post a project',
  description: 'Tell (kalm) what you need and get connected with the right contractor.',
};

export default function PostProjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
