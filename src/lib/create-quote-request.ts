// src/lib/create-quote-request.ts
//
// Sends ONE quote request from a developer to a contractor: writes the
// QuoteRequest row, notifies the contractor (email + push, only if they've
// claimed their account), and sends the admin notification email. Kept
// separate from POST /api/quote-requests so the steps read in one place.
//
// The row is written FIRST, before any email: if an email fails, the
// request is still recorded (the developer's intent isn't lost) and
// emailSentAt stays null. Failed sends also show at Admin > Failed emails.
// The contractor's push carries no developer contact details. Their email
// carries them only for a lead that is fully visible under the free-plan cap
// (see isFullyVisibleLead and sendNewQuoteToContractorEmail).

import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendNewQuoteToContractorEmail, sendQuoteRequestEmail } from '@/lib/email';
import { sendPush } from '@/lib/push';
import { computeLeadVisibility, getMonthStart, maskContactDetails } from '@/lib/lead-limits';
import { monthLeadsFor } from '@/lib/month-leads';

export type QuoteRequestFields = {
  projectType: string;
  location: string;
  budgetRangeLabel: string;
  details: string;
  contactPhone: string;
};

// Uses the dashboard's own rule (computeLeadVisibility over every request of
// every kind this calendar month, oldest first) so the email can never show
// more than the dashboard does. Fails closed: any error means "not visible".
export async function isFullyVisibleLead(contractorId: string, quoteRequestId: string): Promise<boolean> {
  try {
    const [contractor, thisMonth] = await Promise.all([
      prisma.contractor.findUnique({ where: { id: contractorId }, select: { tier: true } }),
      monthLeadsFor(contractorId, getMonthStart()),
    ]);
    if (!contractor) return false;
    return computeLeadVisibility(contractor.tier, thisMonth).get(quoteRequestId) === 'full';
  } catch {
    return false;
  }
}

export async function createQuoteRequest({
  developer,
  contractor,
  fields,
}: {
  developer: { id: string; name: string; email: string };
  contractor: { id: string; name: string; email: string; passwordHash: string | null };
  fields: QuoteRequestFields;
}): Promise<{ id: string; emailSent: boolean }> {
  const quoteRequest = await prisma.quoteRequest.create({
    data: { contractorId: contractor.id, developerId: developer.id, ...fields },
  });

  if (contractor.passwordHash) {
    const baseUrl = process.env.NEXTAUTH_URL ?? '';
    // Same rule as the dashboard: is this lead fully visible to the
    // contractor? Only then does the email carry the details and a reply-to.
    const fullyVisible = await isFullyVisibleLead(contractor.id, quoteRequest.id);
    // The project type and area are free text the developer typed. For a
    // blurred lead they are masked in the email and the push like everywhere
    // else, so a number typed there cannot get past the blur.
    const shownType = fullyVisible ? fields.projectType : maskContactDetails(fields.projectType);
    const shownLocation = fullyVisible ? fields.location : maskContactDetails(fields.location);
    after(() =>
      Promise.all([
        sendNewQuoteToContractorEmail({
          toEmail: contractor.email,
          contractorName: contractor.name,
          projectType: shownType,
          location: shownLocation,
          dashboardUrl: `${baseUrl}/contractor/dashboard`,
          lead: fullyVisible
            ? {
                developerName: developer.name,
                developerEmail: developer.email,
                developerPhone: fields.contactPhone,
                budgetRangeLabel: fields.budgetRangeLabel,
                details: fields.details,
              }
            : undefined,
        }),
        sendPush('CONTRACTOR', contractor.id, {
          title: 'New quote request',
          body: `${shownType} in ${shownLocation}`,
          url: '/contractor/dashboard',
          tag: `quote-${quoteRequest.id}`,
        }),
      ])
    );
  }

  const emailSent = await sendQuoteRequestEmail({
    contractorName: contractor.name,
    developerName: developer.name,
    developerEmail: developer.email,
    ...fields,
  });

  if (emailSent) {
    await prisma.quoteRequest.update({
      where: { id: quoteRequest.id },
      data: { emailSentAt: new Date() },
    });
  }

  return { id: quoteRequest.id, emailSent };
}
