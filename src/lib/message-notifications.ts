// src/lib/message-notifications.ts
//
// "You have a new message" for the other side of a conversation, by email
// AND as a phone/browser notification (the owner's rule: every
// notification goes by email and in the app; push is the app's way of
// reaching someone who isn't looking at it). The in-app unread badge needs
// nothing from here; it's computed from the messages themselves.
//
// Push goes out for every message (the device groups them per conversation
// via the notification tag, so a burst shows as one updating notification).
// Email is throttled: at most one per unread batch, i.e. only if we haven't
// emailed this side since they last read the thread (see notifiedAt on
// QuoteRequest in schema.prisma), so a quick back-and-forth doesn't flood
// an inbox.
//
// The email and notification include a short preview of the message (the
// owner's decision: previews are what make people open it). Read-then-write
// rather than one atomic update, so two messages sent in the same instant
// could both email; the worst case is one duplicate email.

import { prisma } from '@/lib/prisma';
import { sendNewMessageEmail } from '@/lib/email';
import { sendPush } from '@/lib/push';
import { conversationTitle } from '@/lib/conversations';

const PREVIEW_CHARS = 120;

export function messagePreview(body: string): string {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  return oneLine.length > PREVIEW_CHARS ? `${oneLine.slice(0, PREVIEW_CHARS)}…` : oneLine;
}

export async function notifyNewMessage(
  quoteRequestId: string,
  senderRole: 'DEVELOPER' | 'CONTRACTOR',
  body: string
): Promise<void> {
  const qr = await prisma.quoteRequest.findUnique({
    where: { id: quoteRequestId },
    select: {
      kind: true,
      projectType: true,
      location: true,
      developerId: true,
      contractorId: true,
      developerLastReadAt: true,
      contractorLastReadAt: true,
      developerNotifiedAt: true,
      contractorNotifiedAt: true,
      developer: { select: { name: true, email: true } },
      contractor: { select: { name: true, email: true, passwordHash: true } },
    },
  });
  if (!qr) return;

  const toDeveloper = senderRole === 'CONTRACTOR';
  // An admin-entered placeholder contractor has no account to read it with.
  if (!toDeveloper && !qr.contractor.passwordHash) return;

  const fromName = toDeveloper ? qr.contractor.name : qr.developer.name;
  const preview = messagePreview(body);
  const baseUrl = process.env.NEXTAUTH_URL ?? '';
  const path = `/messages/${quoteRequestId}`;

  await sendPush(toDeveloper ? 'DEVELOPER' : 'CONTRACTOR', toDeveloper ? qr.developerId : qr.contractorId, {
    title: fromName,
    body: preview,
    url: path,
    tag: `conversation-${quoteRequestId}`,
  });

  const lastRead = toDeveloper ? qr.developerLastReadAt : qr.contractorLastReadAt;
  const lastNotified = toDeveloper ? qr.developerNotifiedAt : qr.contractorNotifiedAt;
  const alreadyEmailedSinceLastRead = lastNotified !== null && (lastRead === null || lastNotified > lastRead);
  if (alreadyEmailedSinceLastRead) return;

  const sent = await sendNewMessageEmail({
    toEmail: toDeveloper ? qr.developer.email : qr.contractor.email,
    toName: toDeveloper ? qr.developer.name : qr.contractor.name,
    fromName,
    projectType: conversationTitle(qr),
    preview,
    conversationUrl: `${baseUrl}${path}`,
  });
  // Only record it if it actually went out, so a failed send doesn't
  // suppress the next attempt.
  if (sent) {
    await prisma.quoteRequest.update({
      where: { id: quoteRequestId },
      data: { [toDeveloper ? 'developerNotifiedAt' : 'contractorNotifiedAt']: new Date() },
      select: { id: true },
    });
  }
}
