// src/app/api/admin/quote-requests/[id]/whatsapp/route.ts
//
// The admin "Send on WhatsApp" button on a quote request (Admin > Leads,
// 10 Nov 2026). Returns a wa.me link to the CONTRACTOR's phone with the
// message already typed in; the admin page opens it and admin presses send
// in WhatsApp. Nothing is sent from here and nothing is written to the
// database, so the site keeps no record that a WhatsApp went.
//
// The message never carries the developer's name, phone or email (Hassan,
// 10 Nov 2026); this route does not even read them. What it does carry
// depends on the contractor's plan today (see quoteRequestWhatsappText in
// src/lib/whatsapp.ts): Listed (free) gets the work and area plus the
// dashboard link; Plus and Pro also get built-up area, budget and details.
// Free text is masked, so a number typed into the details stays out too.
//
// Quote form requests only (kind QUOTE). The contractor's number never goes
// to a developer: this route is admin only.

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { maskContactDetails } from '@/lib/lead-limits';
import { formatArea } from '@/lib/project-fields';
import { quoteRequestWhatsappText, whatsappMessageLink } from '@/lib/whatsapp';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Your admin session has expired. Please log in again.' }, { status: 401 });
  }

  const { id } = await params;

  const request = await prisma.quoteRequest.findUnique({
    where: { id },
    select: {
      kind: true,
      projectType: true,
      location: true,
      budgetRangeLabel: true,
      builtUpAreaSqft: true,
      details: true,
      contractor: { select: { name: true, phone: true, tier: true, passwordHash: true } },
    },
  });

  if (!request) {
    return NextResponse.json({ error: 'Quote request not found.' }, { status: 404 });
  }
  if (request.kind !== 'QUOTE') {
    return NextResponse.json({ error: 'Send on WhatsApp is for quote form requests only.' }, { status: 400 });
  }

  const { contractor } = request;
  const free = contractor.tier === 'LISTED';

  // The message points to the dashboard for the developer's contact details,
  // so with no login there is nothing the contractor can act on yet.
  if (!contractor.passwordHash) {
    return NextResponse.json(
      { error: `${contractor.name} has no login yet, so they cannot open the dashboard. Send the login link first (Contractors page).` },
      { status: 409 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? '';
  const text = quoteRequestWhatsappText({
    contractorName: contractor.name,
    tier: contractor.tier,
    projectType: maskContactDetails(request.projectType),
    location: maskContactDetails(request.location),
    dashboardUrl: `${baseUrl}/contractor/dashboard`,
    request: free
      ? undefined
      : {
          budgetRangeLabel: request.budgetRangeLabel,
          builtUpArea: formatArea(request.builtUpAreaSqft),
          details: maskContactDetails(request.details),
        },
  });

  const url = whatsappMessageLink(contractor.phone, text);
  if (!url) {
    return NextResponse.json(
      { error: `The phone number saved for ${contractor.name} is not a clear Indian mobile number, so no WhatsApp link can be made. Correct it on the Contractors page.` },
      { status: 409 }
    );
  }

  return NextResponse.json(
    { url, level: free ? 'short' : 'details', contractorName: contractor.name },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
