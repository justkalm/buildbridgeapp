// Sets this section's browser-tab title ("Admin | (kalm)") and link preview
// text. The page itself may be a client component, which can't set them.
import type { Metadata } from 'next';

// robots: the admin area carries its own noindex, so it stays out of search
// results even after launch, when the site-wide noindex is switched off. That
// is why /admin is no longer listed in robots.txt (listing it only advertises
// where the login is; a crawler that is blocked never reads the noindex).
export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
