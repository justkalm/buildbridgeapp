// src/app/api/admin/leads/route.ts
//
// Lead ledger (KALM-259). Admin only, read only, built from existing tables
// (QuoteRequest and Message), no database change. GET /api/admin/leads?month=2026-10
// returns the per-contractor counts for that India-time month (default: this
// month) plus the months that have any leads. Add &format=csv to download a
// spreadsheet. See src/lib/lead-ledger.ts for exactly what each number means.

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getMonthRange, istMonthKey } from '@/lib/lead-limits';
import {
  buildLeadDetails,
  buildLedger,
  ledgerToCsv,
  leadDetailsToCsv,
  monthKeysDescending,
  siteVisitAsLead,
} from '@/lib/lead-ledger';

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const now = new Date();
  const currentMonth = istMonthKey(now);
  const month = req.nextUrl.searchParams.get('month') ?? currentMonth;
  const range = getMonthRange(month);
  if (!range) {
    return NextResponse.json({ error: 'month must look like 2026-10' }, { status: 400 });
  }

  const [requests, replied, earliest, visits, earliestVisit] = await Promise.all([
    prisma.quoteRequest.findMany({
      where: { createdAt: { gte: range.start, lt: range.end } },
      select: {
        id: true,
        contractorId: true,
        status: true,
        kind: true,
        createdAt: true,
        developer: { select: { name: true, email: true } },
      },
    }),
    prisma.message.findMany({
      where: { senderRole: 'CONTRACTOR', quoteRequest: { createdAt: { gte: range.start, lt: range.end } } },
      select: { quoteRequestId: true },
      distinct: ['quoteRequestId'],
    }),
    prisma.quoteRequest.aggregate({ _min: { createdAt: true } }),
    // Site visit requests are leads too (they follow the same free-plan cap).
    prisma.siteVisit.findMany({
      where: { createdAt: { gte: range.start, lt: range.end } },
      select: {
        id: true,
        contractorId: true,
        status: true,
        createdAt: true,
        respondedAt: true,
        developer: { select: { name: true, email: true } },
      },
    }),
    prisma.siteVisit.aggregate({ _min: { createdAt: true } }),
  ]);
  const visitLeads = visits.map((v) => ({ ...siteVisitAsLead(v), developer: v.developer }));

  const contractorIds = [...new Set([...requests.map((r) => r.contractorId), ...visits.map((v) => v.contractorId)])];
  const contractors = await prisma.contractor.findMany({
    where: { id: { in: contractorIds } },
    select: { id: true, name: true, tier: true, email: true },
  });

  // Emails to each contractor that failed to send this month (the Failed emails
  // log records the address). Delivery itself is not tracked.
  const idByEmail = new Map(contractors.map((c) => [c.email.toLowerCase(), c.id]));
  const failures = await prisma.emailFailure.findMany({
    where: { createdAt: { gte: range.start, lt: range.end }, OR: [...idByEmail.keys()].map((address) => ({ to: { contains: address, mode: 'insensitive' as const } })) },
    select: { to: true },
  });
  const failuresByContractor = new Map<string, number>();
  for (const f of failures) {
    // A row can hold several addresses joined by commas (see recordEmailFailure
    // in src/lib/email.ts); count it once for each contractor it names.
    const named = new Set(f.to.split(',').map((a) => a.trim().toLowerCase()));
    for (const address of named) {
      const id = idByEmail.get(address);
      if (id) failuresByContractor.set(id, (failuresByContractor.get(id) ?? 0) + 1);
    }
  }

  const repliedIds = new Set([
    ...replied.map((m) => m.quoteRequestId),
    ...visitLeads.filter((l) => l.replied).map((l) => l.request.id),
  ]);
  const { rows, totals } = buildLedger(
    [...requests, ...visitLeads.map((l) => l.request)],
    repliedIds,
    contractors,
    failuresByContractor
  );

  const details = buildLeadDetails(
    [
      ...requests.map(({ developer, ...r }) => ({ ...r, developerName: developer.name, developerEmail: developer.email })),
      ...visitLeads.map((l) => ({ ...l.request, developerName: l.developer.name, developerEmail: l.developer.email })),
    ],
    repliedIds
  );

  if (req.nextUrl.searchParams.get('format') === 'csv-leads') {
    return new NextResponse(leadDetailsToCsv(details, contractors), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kalm-lead-list-${month}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (req.nextUrl.searchParams.get('format') === 'csv') {
    return new NextResponse(ledgerToCsv(rows, totals), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kalm-leads-${month}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // Every month from the first lead ever (or this month) up to this month, newest first.
  const firstLead = [earliest._min.createdAt, earliestVisit._min.createdAt]
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const months = monthKeysDescending(istMonthKey(firstLead ?? now), currentMonth);

  return NextResponse.json({ month, months, rows, totals, details });
}
