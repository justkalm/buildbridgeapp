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
import { buildLedger, ledgerToCsv, monthKeysDescending } from '@/lib/lead-ledger';

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

  const [requests, replied, earliest] = await Promise.all([
    prisma.quoteRequest.findMany({
      where: { createdAt: { gte: range.start, lt: range.end } },
      select: { id: true, contractorId: true, status: true, kind: true },
    }),
    prisma.message.findMany({
      where: { senderRole: 'CONTRACTOR', quoteRequest: { createdAt: { gte: range.start, lt: range.end } } },
      select: { quoteRequestId: true },
      distinct: ['quoteRequestId'],
    }),
    prisma.quoteRequest.aggregate({ _min: { createdAt: true } }),
  ]);

  const contractorIds = [...new Set(requests.map((r) => r.contractorId))];
  const contractors = await prisma.contractor.findMany({
    where: { id: { in: contractorIds } },
    select: { id: true, name: true, tier: true, email: true },
  });

  // Emails to each contractor that failed to send this month (the Failed emails
  // log records the address). Delivery itself is not tracked.
  const idByEmail = new Map(contractors.map((c) => [c.email.toLowerCase(), c.id]));
  const failures = await prisma.emailFailure.findMany({
    where: { createdAt: { gte: range.start, lt: range.end }, to: { in: [...idByEmail.keys()], mode: 'insensitive' } },
    select: { to: true },
  });
  const failuresByContractor = new Map<string, number>();
  for (const f of failures) {
    const id = idByEmail.get(f.to.toLowerCase());
    if (id) failuresByContractor.set(id, (failuresByContractor.get(id) ?? 0) + 1);
  }

  const { rows, totals } = buildLedger(
    requests, new Set(replied.map((m) => m.quoteRequestId)),
    contractors,
    failuresByContractor
  );

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
  const months = monthKeysDescending(istMonthKey(earliest._min.createdAt ?? now), currentMonth);

  return NextResponse.json({ month, months, rows, totals });
}
