// src/lib/contractor-invite.ts
//
// "Your listing is ready, set your password" email for contractors that
// admin adds by hand (17 Oct 2026). Before this, a contractor added from a
// /join form had no login and nothing told them how to get one: they had
// to find the sign-up page and use the claim flow themselves.
//
// It reuses the claim flow's machinery exactly: a one-time token in
// passwordResetToken, finished on /reset-password, which sets the first
// password and marks the email verified (see
// src/app/api/contractors/reset-password/route.ts). So the only new thing
// is WHO starts it (admin, not the contractor) and how long the link lasts.
//
// Safety:
//   - Never for a contractor who already has a password: a login link
//     must not become a way for admin (or a stolen admin session) to take
//     over a working account. They use "Forgot password" instead.
//   - The link only ever goes to the email on the listing.
//   - 72 hours, not the 1 hour of a reset link: this email arrives
//     unasked, often while the contractor is on site. Sending again (the
//     admin list's "Send login link") replaces the old link.

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/site';
import { sendListingReadyEmail } from '@/lib/email';
import type { InviteResult } from '@/lib/contractor-invite-text';

export type { InviteResult } from '@/lib/contractor-invite-text';
export { inviteResultMessage } from '@/lib/contractor-invite-text';

export const INVITE_LINK_HOURS = 72;

export async function sendContractorInvite(contractorId: string): Promise<InviteResult> {
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { id: true, name: true, email: true, passwordHash: true },
  });
  if (!contractor) return 'not-found';
  if (contractor.passwordHash) return 'has-login';

  const token = crypto.randomBytes(32).toString('hex');
  await prisma.contractor.update({
    where: { id: contractor.id },
    data: {
      passwordResetToken: token,
      passwordResetTokenExpiresAt: new Date(Date.now() + INVITE_LINK_HOURS * 60 * 60 * 1000),
    },
  });

  const sent = await sendListingReadyEmail({
    toEmail: contractor.email,
    toName: contractor.name,
    setPasswordUrl: `${SITE_URL}/reset-password?token=${token}&role=contractor&welcome=1`,
    linkHours: INVITE_LINK_HOURS,
  });
  return sent ? 'sent' : 'email-failed';
}
