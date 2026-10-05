// src/app/api/admin/reports/route.ts
//
// The Reports desk list (KALM-255). ?status=OPEN (default), ACTIONED or
// DISMISSED. Oldest first, so the longest-waiting report is at the top.
// Admin-only. Each report is returned with a short description of what it is
// about, looked up now (a report keeps only the id, so it survives the
// content being deleted). For a project it also returns the photos, so the
// admin can look at what was reported. A message report returns only the
// conversation id: the text is read deliberately, from the admin Messages page.

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const asked = new URL(req.url).searchParams.get('status');
  const status = asked === 'ACTIONED' || asked === 'DISMISSED' ? asked : 'OPEN';

  const reports = await prisma.report.findMany({
    where: { status },
    orderBy: { createdAt: 'asc' },
  });

  const projectIds = reports.filter((r) => r.targetType === 'PROJECT' && r.targetId).map((r) => r.targetId as string);
  const contractorIds = reports.filter((r) => r.targetType === 'CONTRACTOR' && r.targetId).map((r) => r.targetId as string);

  const [projects, contractors] = await Promise.all([
    projectIds.length
      ? prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: {
            id: true,
            title: true,
            approvalStatus: true,
            imageUrls: true,
            contractor: { select: { name: true } },
          },
        })
      : [],
    contractorIds.length
      ? prisma.contractor.findMany({ where: { id: { in: contractorIds } }, select: { id: true, name: true, slug: true } })
      : [],
  ]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const contractorById = new Map(contractors.map((c) => [c.id, c]));

  return NextResponse.json(
    reports.map((r) => {
      const project = r.targetType === 'PROJECT' && r.targetId ? projectById.get(r.targetId) : undefined;
      const contractor = r.targetType === 'CONTRACTOR' && r.targetId ? contractorById.get(r.targetId) : undefined;
      return {
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        details: r.details,
        reporterEmail: r.reporterEmail,
        reporterRole: r.reporterRole,
        status: r.status,
        resolutionNote: r.resolutionNote,
        resolvedAt: r.resolvedAt,
        createdAt: r.createdAt,
        project: project
          ? {
              id: project.id,
              title: project.title,
              approvalStatus: project.approvalStatus,
              contractorName: project.contractor.name,
              imageUrls: project.imageUrls.slice(0, 4),
            }
          : null,
        contractor: contractor ? { name: contractor.name, slug: contractor.slug } : null,
        // True when the report points at something that no longer exists.
        targetGone:
          (r.targetType === 'PROJECT' && !project) || (r.targetType === 'CONTRACTOR' && !contractor),
      };
    }),
  );
}
