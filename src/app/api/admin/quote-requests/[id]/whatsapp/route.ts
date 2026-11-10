// src/app/api/admin/quote-requests/[id]/whatsapp/route.ts
//
// The admin "Send on WhatsApp" button on a quote request (Admin > Leads,
// 10 Nov 2026). Returns a wa.me link to the CONTRACTOR's phone with the
// message already typed in; the admin page opens it and admin presses send
// in WhatsApp. Nothing is sent from here and nothing is written to the
// database, so the site keeps no record that a WhatsApp went.
//
// What the message carries depends on the contractor's plan today (see
// quoteRequestWhatsappText in src/lib/whatsapp.ts): Listed (free) gets the
// work and area only, with contact details masked, plus the dashboard link;
// Plus and Pro get the full request. The developer's details are read only
// when one request is opened this way, never for the whole Leads list.
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
      contactPhone: true,
      developer: { select: { email: true } },
      contractor: { select: { name: true, phone: true, tier: true, passwordHash: true } },
    },
  });

  if (!request) {
    return NextResponse.json({ error: 'Quote request not found.' }, { status: 404 });
  }
  if (request.kind !== 'QUOTE') {
    return NextResponse.json({ error: 'Send on WhatsApp is for quote form requests only.' }, { status: 400 });
  }

  const { contractor, developer } = request;
  const free = contractor.tier === 'LISTED';
  const hasLogin = !!contractor.passwordHash;

  // A free contractor's message is only a pointer to the dashboard, so with
  // no login there is nothing useful to send yet.
  if (free && !hasLogin) {
    return NextResponse.json(
      { error: `${contractor.name} has no login yet, so they cannot open the dashboard. Send the login link first (Contractors page).` },
      { status: 409 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? '';
  const text = quoteRequestWhatsappText({
    contractorName: contractor.name,
    tier: contractor.tier,
    projectType: free ? maskContactDetails(request.projectType) : request.projectType,
    location: free ? maskContactDetails(request.location) : request.location,
    dashboardUrl: hasLogin ? `${baseUrl}/contractor/dashboard` : null,
    lead: free
      ? undefined
      : {
          developerPhone: request.contactPhone,
          developerEmail: developer.email,
          budgetRangeLabel: request.budgetRangeLabel,
          builtUpArea: formatArea(request.builtUpAreaSqft),
          details: request.details,
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
    { url, level: free ? 'short' : 'full', contractorName: contractor.name },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
