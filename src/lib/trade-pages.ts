// src/lib/trade-pages.ts
//
// Data for the public trade pages (/trades and /trades/<slug>) and their
// sitemap entries (SEO, 5 Nov 2026): the real VERIFIED contractors in each
// trade. Demo profiles are left out, so a trade page never lists a made-up
// contractor under the (kalm) name. A trade with nobody in it still has a
// page, but it is kept out of Google (noindex, and not in the sitemap) until
// someone is listed, because an empty list page counts against the site.

import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { isDemoLicense } from '@/lib/license';
import { ALL_TRADES, hasTrade } from '@/lib/trade-types';

export type TradeCard = {
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string;
  area: string;
  tradeTypes: string[];
  yearsInBusiness: number | null;
  reverifyPending: boolean;
  projectCount: number;
};

// Every real verified contractor, most experienced first (Browse's default
// order). One light query serves every trade page in the request.
const realVerifiedContractors = cache(async (): Promise<TradeCard[]> => {
  const rows = await prisma.contractor.findMany({
    where: { verificationStatus: 'VERIFIED' },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      city: true,
      area: true,
      tradeTypes: true,
      yearsInBusiness: true,
      reverifyPending: true,
      licenseNumber: true,
      _count: { select: { projects: { where: { approvalStatus: 'APPROVED' } } } },
    },
    orderBy: [{ yearsInBusiness: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
  });
  return rows
    .filter((r) => !isDemoLicense(r.licenseNumber))
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      logoUrl: r.logoUrl,
      city: r.city,
      area: r.area,
      tradeTypes: r.tradeTypes,
      yearsInBusiness: r.yearsInBusiness,
      reverifyPending: r.reverifyPending,
      projectCount: r._count.projects,
    }));
});

export async function contractorsInTrade(trade: string): Promise<TradeCard[]> {
  return (await realVerifiedContractors()).filter((c) => hasTrade(c.tradeTypes, trade));
}

// How many real verified contractors each trade has, in list order.
export async function tradeCounts(): Promise<{ trade: string; count: number }[]> {
  const all = await realVerifiedContractors();
  return ALL_TRADES.map((trade) => ({ trade, count: all.filter((c) => hasTrade(c.tradeTypes, trade)).length }));
}
