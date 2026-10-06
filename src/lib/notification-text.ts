// src/lib/notification-text.ts
//
// What a "new message" push or email may say. Pure text rules, kept apart
// from src/lib/message-notifications.ts (which talks to the database and the
// email and push services) so they can be tested on their own.

import { maskContactDetails } from '@/lib/lead-limits';

const PREVIEW_CHARS = 120;

export function messagePreview(body: string): string {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  return oneLine.length > PREVIEW_CHARS ? `${oneLine.slice(0, PREVIEW_CHARS)}…` : oneLine;
}

// What a notification may say. A free contractor's lead past their monthly
// five is blurred everywhere, so the push and the email for it carry NO
// preview of the developer's message (it can hold a phone number or email),
// only that a message arrived. The project title is masked the same way.
export const BLURRED_MESSAGE_NOTICE = 'You have a new message. Open (kalm) to see it.';

export function notificationTextFor(
  blurredForRecipient: boolean,
  body: string,
  title: string
): { preview: string; title: string } {
  if (!blurredForRecipient) return { preview: messagePreview(body), title };
  return { preview: BLURRED_MESSAGE_NOTICE, title: maskContactDetails(title) };
}

