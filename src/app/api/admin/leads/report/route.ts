// src/app/api/admin/leads/report/route.ts
//
// One contractor's lead report for one India-time month, for the admin to
// print or copy and send to them. Admin only, read only. See
// src/lib/lead-report.ts for what it holds (and never holds: no developer
// email or phone, no details text).

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getMonthRange, istMonthKey } from '@/lib/lead-limits';
import { buildContractorReport } from '@/lib/lead-report';

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const contractorId = req.nextUrl.searchParams.get('contractor') ?? '';
  const currentMonth = istMonthKey(new Date());
  const month = req.nextUrl.searchParams.get('month') ?? currentMonth;
  const range = getMonthRange(month);
  if (!contractorId || !range) {
    return NextResponse.json({ error: 'contractor and a month like 2026-10 are required' }, { status: 400 });
  }

  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { id: true, name: true, tier: true },
  });
  if (!contractor) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
  }

  const [requests, replied] = await Promise.all([
    prisma.quoteRequest.findMany({
      where: { contractorId, createdAt: { gte: range.start, lt: range.end } },
      select: {
        id: true,
        status: true,
        kind: true,
        createdAt: true,
        projectType: true,
        location: true,
        developer: { select: { name: true } },
      },
    }),
    prisma.message.findMany({
      where: { senderRole: 'CONTRACTOR', quoteRequest: { contractorId, createdAt: { gte: range.start, lt: range.end } } },
      select: { quoteRequestId: true },
      distinct: ['quoteRequestId'],
    }),
  ]);

  const report = buildContractorReport(
    requests.map(({ developer, ...r }) => ({ ...r, developerName: developer.name })),
    new Set(replied.map((m) => m.quoteRequestId)),
    contractor.tier,
    month === currentMonth
  );

  return NextResponse.json({ contractor: { id: contractor.id, name: contractor.name, tier: contractor.tier }, month, report });
}
