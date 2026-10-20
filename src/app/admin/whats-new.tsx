// src/app/admin/whats-new.tsx
//
// The "What's new" panel at the top of the admin home (20 Oct 2026): the
// last 7 days of join forms, sign-ups, project posts and quote requests,
// newest first, each linking to the admin page that handles it. Anything
// from the last 24 hours is marked New. It is the in-app twin of the admin
// alert emails (see adminAlertTo in src/lib/email.ts), so a missed email is
// still caught here. Read only, no database changes: the admin login is one
// shared password, so there is no per-person "seen" state to store.
// Demo contractors (licence starting DEMO/) are left out.

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { isDemoLicense } from '@/lib/license';

type Item = { at: Date; kind: string; title: string; detail: string; href: string };

const DAY = 24 * 60 * 60 * 1000;

// Loading lives outside the component: it reads the clock, which React's
// lint rules don't allow during render.
async function loadWhatsNew(): Promise<{ items: Item[]; now: number }> {
  const now = Date.now();
  const since = new Date(now - 7 * DAY);
  const take = 15;

  const [forms, contractors, developers, posts, quotes] = await Promise.all([
    prisma.contractorApplication.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, businessName: true, area: true },
      orderBy: { createdAt: 'desc' },
      take,
    }),
    prisma.contractor.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, name: true, area: true, emailVerified: true, licenseNumber: true },
      orderBy: { createdAt: 'desc' },
      take,
    }),
    prisma.developer.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, name: true, emailVerified: true },
      orderBy: { createdAt: 'desc' },
      take,
    }),
    prisma.projectPost.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, projectType: true, location: true },
      orderBy: { createdAt: 'desc' },
      take,
    }),
    prisma.quoteRequest.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, projectType: true, location: true, contractor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    }),
  ]);

  const items: Item[] = [
    ...forms.map((f) => ({
      at: f.createdAt,
      kind: 'Join form',
      title: f.businessName,
      detail: f.area,
      href: '/admin/applications',
    })),
    ...contractors
      .filter((c) => !isDemoLicense(c.licenseNumber))
      .map((c) => ({
        at: c.createdAt,
        kind: 'Contractor account',
        title: c.name,
        detail: c.emailVerified ? c.area : `${c.area} · email not confirmed yet`,
        href: '/admin/contractors',
      })),
    ...developers.map((d) => ({
      at: d.createdAt,
      kind: 'Developer sign-up',
      title: d.name,
      detail: d.emailVerified ? '' : 'email not confirmed yet',
      href: '/admin/developers',
    })),
    ...posts.map((p) => ({
      at: p.createdAt,
      kind: 'Project posted',
      title: p.projectType,
      detail: p.location,
      href: '/admin/project-posts',
    })),
    ...quotes.map((q) => ({
      at: q.createdAt,
      kind: 'Quote request',
      title: `${q.projectType} for ${q.contractor.name}`,
      detail: q.location,
      href: '/admin/leads',
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, take);

  return { items, now };
}

export default async function WhatsNew() {
  const { items, now } = await loadWhatsNew();
  const newCount = items.filter((i) => now - i.at.getTime() < DAY).length;

  return (
    <section className="bg-white border border-line rounded-md p-6 mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display font-semibold text-lg">What&apos;s new</h2>
        <span className="text-sm text-stone">
          {newCount > 0 ? `${newCount} in the last 24 hours` : 'Nothing in the last 24 hours'}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-stone text-sm">Nothing in the last 7 days.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((i, n) => {
            const fresh = now - i.at.getTime() < DAY;
            return (
              <li key={n}>
                <Link href={i.href} className="flex items-start justify-between gap-4 py-3 hover:bg-paper">
                  <span className="min-w-0">
                    <span className="block text-xs text-stone">
                      {fresh && <span className="font-semibold text-ink mr-2">New</span>}
                      {i.kind}
                    </span>
                    <span className="block truncate">{i.title}</span>
                    {i.detail && <span className="block text-sm text-stone truncate">{i.detail}</span>}
                  </span>
                  <time className="text-xs text-stone shrink-0" dateTime={i.at.toISOString()}>
                    {i.at.toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
