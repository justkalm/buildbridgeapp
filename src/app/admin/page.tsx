// src/app/admin/page.tsx
//
// Server component. Checks the admin session cookie directly (no client
// round-trip, no flash of the wrong content) and renders either the login
// form or the dashboard with the three admin actions: add a contractor,
// manage existing contractors, and view current users.

import Link from 'next/link';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import AdminLoginForm from './login-form';
import AdminTabs from '@/components/AdminTabs';

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    return <AdminLoginForm />;
  }

  return (
    <main className="min-h-screen bg-paper py-10 px-6">
      <div className="max-w-2xl mx-auto">
        {/*
          AdminTabs has no "active" tab here on purpose — /admin itself
          isn't one of Contractors/Developers/Project Posts, it's the home
          screen above all three. Omitting active means none of the three
          tabs render as "current", which is the honest state: you're not
          currently inside any of them.
        */}
        <AdminTabs />
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display font-bold text-2xl tracking-tight">Admin</h1>
          <Link href="/browse" className="text-sm text-stone hover:text-ink">
            View live site →
          </Link>
        </div>

        <div className="grid gap-4">
          <Link
            href="/admin/contractors/new"
            className="block bg-white border border-line rounded-md p-6 hover:border-ink transition-colors"
          >
            <h2 className="font-display font-semibold text-lg mb-1">New Contractor</h2>
            <p className="text-stone text-sm">Add a contractor to the directory by hand.</p>
          </Link>

          <Link
            href="/admin/contractors"
            className="block bg-white border border-line rounded-md p-6 hover:border-ink transition-colors"
          >
            <h2 className="font-display font-semibold text-lg mb-1">Contractors</h2>
            <p className="text-stone text-sm">
              View all contractors, update verification status or tier, or delete one.
            </p>
          </Link>

          <Link
            href="/admin/developers"
            className="block bg-white border border-line rounded-md p-6 hover:border-ink transition-colors"
          >
            <h2 className="font-display font-semibold text-lg mb-1">Developers</h2>
            <p className="text-stone text-sm">See every developer account that has signed up on the site.</p>
          </Link>

          <Link
            href="/admin/project-posts"
            className="block bg-white border border-line rounded-md p-6 hover:border-ink transition-colors"
          >
            <h2 className="font-display font-semibold text-lg mb-1">Project Posts</h2>
            <p className="text-stone text-sm">
              Review projects submitted via &quot;Post a Project&quot; and alert PRO contractors.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
