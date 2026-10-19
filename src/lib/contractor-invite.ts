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
//   - The link only ever goes to the email on the listing. A /join email
//     is whatever the sender typed, so admin confirms it with the business
//     (a phone call) before ticking the box: otherwise someone could send
//     a form in a real firm's name and get its dashboard.
//   - 72 hours, not the 1 hour of a reset link: this email arrives
//     unasked, often while the contractor is on site. Sending again (the
//     admin list's "Send login link") replaces the old link.
//
// WhatsApp (owner, 19 Oct 2026): the admin list also has "Send on
// WhatsApp", which emails the link as usual AND hands that same link back
// to the admin screen so it can open a WhatsApp chat with the message
// filled in. Only that route asks for the link (issueContractorInvite);
// everything else uses sendContractorInvite, which never returns it. This
// means admin can now see a set-password link, which the rest of this
// design avoided: accepted by the owner because it only ever exists for a
// listing with no password, dies on first use or after 72 hours, and is
// replaced by the next send.

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/site';
import { sendListingReadyEmail } from '@/lib/email';
import type { InviteResult } from '@/lib/contractor-invite-text';

export type { InviteResult } from '@/lib/contractor-invite-text';
export { inviteResultMessage } from '@/lib/contractor-invite-text';

export const INVITE_LINK_HOURS = 72;

export async function sendContractorInvite(contractorId: string): Promise<InviteResult> {
  return (await issueContractorInvite(contractorId)).result;
}

// Same as sendContractorInvite, but also returns the link it made (null when
// none was made). The link is still there when the email failed, so
// WhatsApp can stand in for it. Only for the admin WhatsApp button.
export async function issueContractorInvite(
  contractorId: string
): Promise<{ result: InviteResult; setPasswordUrl: string | null }> {
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { id: true, name: true, email: true, passwordHash: true },
  });
  if (!contractor) return { result: 'not-found', setPasswordUrl: null };
  if (contractor.passwordHash) return { result: 'has-login', setPasswordUrl: null };

  const token = crypto.randomBytes(32).toString('hex');
  // Conditional on "still no password" in the same write, so a contractor
  // who finishes a claim link between the check above and here can't end
  // up with a live 72-hour token on a working login.
  const written = await prisma.contractor.updateMany({
    where: { id: contractor.id, passwordHash: null },
    data: {
      passwordResetToken: token,
      passwordResetTokenExpiresAt: new Date(Date.now() + INVITE_LINK_HOURS * 60 * 60 * 1000),
    },
  });
  if (written.count === 0) return { result: 'has-login', setPasswordUrl: null };

  const setPasswordUrl = `${SITE_URL}/reset-password?token=${token}&role=contractor&welcome=1`;
  const sent = await sendListingReadyEmail({
    toEmail: contractor.email,
    toName: contractor.name,
    setPasswordUrl,
    linkHours: INVITE_LINK_HOURS,
  });
  return { result: sent ? 'sent' : 'email-failed', setPasswordUrl };
}
