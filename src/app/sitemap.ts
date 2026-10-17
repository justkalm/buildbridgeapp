// src/app/sitemap.ts
//
// /sitemap.xml: the list of public pages for Google (17 Oct 2026). The
// fixed pages, plus every contractor profile the public can open, which
// is VERIFIED contractors only (same rule as /api/contractors and the
// profile page). Built fresh on each request (connection() below; without
// it Next builds this file once at deploy time), so a newly verified
// contractor shows up without a redeploy. Pages that are hidden or private are left out on purpose:
// /pricing (plans hidden for the pilot), /join, sign-in and password
// pages, dashboards, messages, admin.

import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/site';

const FIXED: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/browse', priority: 0.9, changeFrequency: 'daily' },
  { path: '/post-project', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/contractor/signup', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/signup', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.2, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'monthly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const contractors = await prisma.contractor.findMany({
    where: { verificationStatus: 'VERIFIED' },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  return [
    ...FIXED.map((p) => ({
      url: `${SITE_URL}${p.path}`,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    })),
    ...contractors.map((c) => ({
      url: `${SITE_URL}/contractors/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
