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
// The contractor's email and push carry no developer contact details, so
// the free-plan lead cap still holds (see sendNewQuoteToContractorEmail).

import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendNewQuoteToContractorEmail, sendQuoteRequestEmail } from '@/lib/email';
import { sendPush } from '@/lib/push';

export type QuoteRequestFields = {
  projectType: string;
  location: string;
  budgetRangeLabel: string;
  details: string;
  contactPhone: string;
};

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
    after(() =>
      Promise.all([
        sendNewQuoteToContractorEmail({
          toEmail: contractor.email,
          contractorName: contractor.name,
          projectType: fields.projectType,
          location: fields.location,
          dashboardUrl: `${baseUrl}/contractor/dashboard`,
        }),
        sendPush('CONTRACTOR', contractor.id, {
          title: 'New quote request',
          body: `${fields.projectType} in ${fields.location}`,
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
