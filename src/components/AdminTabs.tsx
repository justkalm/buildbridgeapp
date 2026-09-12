// src/components/AdminTabs.tsx
//
// Persistent tab bar for admin pages. Before this, each admin page linked
// to at most one or two others in an ad-hoc way (e.g. Contractors linked
// to Project Posts, but Developers and Project Posts never linked to each
// other) — this replaces that with one shared, consistent nav dropped into
// every admin page, so getting from any admin page to any other is always
// one click, not dependent on which page happens to link where.
//
// `active` tells this component which tab to visually highlight — pass the
// current page's own key so it doesn't render its own link as clickable-
// looking-different-from-current. This component is only rendered on the
// three actual sub-pages (Contractors/Developers/Project Posts) — /admin
// itself (the home screen) doesn't render it at all, since showing tabs
// (or a link back to itself) on the page they point back TO is circular.

import Link from 'next/link';

const TABS = [
  { key: 'contractors', label: 'Contractors', href: '/admin/contractors' },
  { key: 'developers', label: 'Developers', href: '/admin/developers' },
  { key: 'project-posts', label: 'Project Posts', href: '/admin/project-posts' },
] as const;

export type AdminTabKey = (typeof TABS)[number]['key'];

export default function AdminTabs({ active }: { active: AdminTabKey }) {
  return (
    <div className="flex items-center justify-between mb-6 -mt-2 border-b border-line">
      <nav className="flex gap-1">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`text-sm px-3 py-2.5 border-b-2 -mb-px transition-colors ${
              tab.key === active
                ? 'border-ink text-ink font-medium'
                : 'border-transparent text-stone hover:text-ink'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <Link href="/admin" className="text-sm text-stone hover:text-ink pb-2.5">
        ← Admin home
      </Link>
    </div>
  );
}
