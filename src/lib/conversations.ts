// src/lib/conversations.ts
//
// Small shared helpers for the Messages inbox and conversation screens.

// How a conversation is named in the inbox and its header: the quote's
// project and location, "Posted project: …" for a conversation started from
// a project alert, or "General enquiry" for a developer's direct question
// (kind ENQUIRY, whose quote fields hold placeholder values).
export function conversationTitle(qr: {
  kind: 'QUOTE' | 'ENQUIRY' | 'PROJECT';
  projectType: string;
  location: string;
}) {
  if (qr.kind === 'ENQUIRY') return 'General enquiry';
  const project = `${qr.projectType} · ${qr.location}`;
  return qr.kind === 'PROJECT' ? `Posted project: ${project}` : project;
}
