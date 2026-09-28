// src/lib/ics.ts
//
// Builds a calendar invite (.ics file, the iCalendar format that Google
// Calendar, Apple Calendar and Outlook all read) for a confirmed site
// visit. Attached to the confirmation emails and also downloadable from
// both dashboards via GET /api/site-visits/[id]/calendar.
//
// Deliberately minimal: one VEVENT, times in UTC ("Z" suffix) so every
// calendar app converts to the reader's own timezone, and a stable UID
// per visit so re-downloading the file updates the same calendar entry
// rather than creating a duplicate. METHOD:PUBLISH (not REQUEST): this is
// "here's an event to add", not a meeting invitation expecting RSVPs back
// to an organizer mailbox we don't run.

function toIcsDate(d: Date): string {
  // 2026-10-04T05:00:00.000Z → 20261004T050000Z
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// RFC 5545 text escaping: backslash, semicolon, comma and newlines.
function esc(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Lines longer than 75 octets must be folded (continued on the next line
// with a leading space). Folding by characters is a safe approximation
// here since non-ASCII characters in these fields are rare.
function fold(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) parts.push(line.slice(i, i + 73));
  return parts.join('\r\n ');
}

export function buildVisitIcs(input: {
  visitId: string;
  start: Date;
  durationMs: number;
  summary: string;
  description: string;
  location?: string | null;
}): string {
  const end = new Date(input.start.getTime() + input.durationMs);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//(kalm)//Site visits//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:site-visit-${input.visitId}@kalm`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(input.start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${esc(input.summary)}`,
    `DESCRIPTION:${esc(input.description)}`,
    ...(input.location ? [`LOCATION:${esc(input.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
