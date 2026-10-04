// src/app/api/contractors/route.ts
//
// Returns contractors for the browse page, one batch at a time (KALM pagination,
// 5 Oct 2026). The old version sent every contractor in one response and the
// browser did the filtering and sorting; now the server does both and sends
// at most PAGE_SIZE cards per request, so the response stays small however
// many contractors there are.
//
// Query params (all optional):
//   trade, city, area      filters (city/area match regardless of capitals)
//   minExperience          years in business, at least
//   minProjects            projects listed, at least
//   sort                   experience (default) | projects | location
//   offset                 how many cards to skip (Load more sends the count
//                          already shown); limit is capped at PAGE_SIZE
//
// Response: { items, total, realCount, nextOffset, facets? }
//   total      how many contractors match the filters (demos included)
//   realCount  how many of those are real, not demo; the "N verified
//              contractors" line on Browse, so it updates by itself as
//              contractors are verified
//   nextOffset where the next batch starts, or null when there is no more
//   facets     the dropdown options (cities, areas with counts, trade counts),
//              only sent with the first batch (offset 0)
//
// Only ever returns VERIFIED contractors — no query param can change this.
// (A past ?includeUnverified=true escape hatch with no auth check was
// removed on purpose; the admin page has its own gated endpoint.)
//
// How it works: one light query reads just the fields needed to filter and
// sort for every verified contractor (a few small columns, no photos or
// descriptions), the same rules the browser used to apply are run here, then
// only the page being sent is fetched in full. Fine for thousands of rows;
// if it ever reaches tens of thousands, move the sort into SQL.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isDemoLicense } from '@/lib/license';
import { normalizeLocation } from '@/lib/location';
import { hasTrade, ALL_TRADES } from '@/lib/trade-types';
import { MUMBAI_AREAS } from '@/lib/mumbai-areas';

const PAGE_SIZE = 20;

type SortOption = 'experience' | 'projects' | 'location';
const SORTS: SortOption[] = ['experience', 'projects', 'location'];
const TIER_RANK = { PRO: 0, PLUS: 1, LISTED: 2 } as const;

function intParam(value: string | null): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trade = searchParams.get('trade');
  const city = searchParams.get('city');
  const area = searchParams.get('area');
  const minExperience = intParam(searchParams.get('minExperience'));
  const minProjects = intParam(searchParams.get('minProjects'));
  const sortParam = searchParams.get('sort') as SortOption | null;
  const sort: SortOption = sortParam && SORTS.includes(sortParam) ? sortParam : 'experience';
  const offset = intParam(searchParams.get('offset'));
  const limit = Math.min(intParam(searchParams.get('limit')) || PAGE_SIZE, PAGE_SIZE);

  // Light rows, in the same base order the old query used (paid tiers, then
  // rating); id last so "Load more" never repeats or skips a card.
  const rows = await prisma.contractor.findMany({
    where: { verificationStatus: 'VERIFIED' },
    select: {
      id: true,
      city: true,
      area: true,
      tradeTypes: true,
      tier: true,
      yearsInBusiness: true,
      licenseNumber: true,
      _count: { select: { projects: true } },
    },
    orderBy: [{ tier: 'desc' }, { rating: 'desc' }, { id: 'asc' }],
  });

  const light = rows.map((r) => ({
    id: r.id,
    city: normalizeLocation(r.city),
    area: normalizeLocation(r.area),
    tradeTypes: r.tradeTypes,
    tier: r.tier,
    years: r.yearsInBusiness ?? 0,
    projects: r._count.projects,
    isDemo: isDemoLicense(r.licenseNumber),
  }));

  // Dropdown options come from everyone verified, not just the current
  // filters, the same as before.
  const tradeCounts: Record<string, number> = {};
  for (const t of ALL_TRADES) {
    tradeCounts[t] = light.filter((r) => hasTrade(r.tradeTypes, t)).length;
  }
  // Every listed Mumbai area is offered, with how many contractors are in it
  // (so a developer sees the whole range even where it's still empty), plus
  // any other area a contractor has typed in ("Other area").
  const areaCounts = new Map<string, number>(MUMBAI_AREAS.map((a) => [a, 0]));
  for (const r of light) {
    if (r.area) areaCounts.set(r.area, (areaCounts.get(r.area) ?? 0) + 1);
  }
  const facets = {
    cities: Array.from(new Set(light.map((r) => r.city).filter(Boolean))).sort(),
    areas: Array.from(areaCounts, ([name, count]) => ({ name, count })).sort((x, y) =>
      x.name.localeCompare(y.name)
    ),
    tradeCounts,
  };

  const wantedCity = city ? normalizeLocation(city) : null;
  const wantedArea = area ? normalizeLocation(area) : null;
  let matches = light.filter(
    (r) =>
      (!trade || trade === 'all' || hasTrade(r.tradeTypes, trade)) &&
      (!wantedCity || r.city === wantedCity) &&
      (!wantedArea || r.area === wantedArea) &&
      r.years >= minExperience &&
      r.projects >= minProjects
  );

  // KALM-172 ranking, unchanged: profiles with no projects go last, then
  // paid tiers (PRO, PLUS) above free, then the chosen sort. Array.sort is
  // stable, so ties keep the base order above.
  matches = [...matches].sort((a, b) => {
    const emptyDiff = Number(a.projects === 0) - Number(b.projects === 0);
    if (emptyDiff !== 0) return emptyDiff;
    const tierDiff = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (tierDiff !== 0) return tierDiff;
    if (sort === 'experience') return b.years - a.years;
    if (sort === 'projects') return b.projects - a.projects;
    return `${a.city}${a.area}`.localeCompare(`${b.city}${b.area}`);
  });

  const total = matches.length;
  const realCount = matches.filter((r) => !r.isDemo).length;
  const pageIds = matches.slice(offset, offset + limit).map((r) => r.id);
  const demoById = new Map(matches.map((r) => [r.id, r.isDemo]));

  const full = await prisma.contractor.findMany({
    where: { id: { in: pageIds } },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      city: true,
      area: true,
      tradeTypes: true,
      verificationStatus: true,
      reverifyPending: true, // shows "Verified · update in review"; see VerifiedBadge
      tier: true,
      yearsInBusiness: true,
      rating: true,
      reviewCount: true,
      _count: { select: { projects: true } },
    },
  });
  const byId = new Map(full.map((c) => [c.id, c]));
  // Send a plain isDemo flag, not the licence number itself.
  const items = pageIds
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => ({ ...c, isDemo: demoById.get(c.id) === true }));

  const nextOffset = offset + items.length < total ? offset + items.length : null;

  return NextResponse.json({
    items,
    total,
    realCount,
    nextOffset,
    ...(offset === 0 ? { facets } : {}),
  });
}
