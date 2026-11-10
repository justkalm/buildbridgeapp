// src/lib/whatsapp.ts
//
// Turns a phone number as typed by a contractor ("98200 12345", "+91 98200
// 12345", "098200 12345") into the digits-with-country-code form a
// wa.me link needs, or null when we can't be sure what number it is.
// Mumbai only for now, so a bare ten-digit mobile number is read as Indian.
// A wrong guess would open a chat with a stranger, so anything unclear
// returns null and the admin screen shows the number without a link.

export function whatsappDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `91${digits.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return digits;
  return null;
}

export function whatsappLink(phone: string): string | null {
  const digits = whatsappDigits(phone);
  return digits ? `https://wa.me/${digits}` : null;
}

// The same chat link with a message already typed in, for the admin "Send
// on WhatsApp" button. Admin still presses send in WhatsApp themselves.
export function whatsappMessageLink(phone: string, text: string): string | null {
  const base = whatsappLink(phone);
  return base ? `${base}?text=${encodeURIComponent(text)}` : null;
}

// The login-link message for a contractor added from the /join form.
export function loginLinkWhatsappText(name: string, setPasswordUrl: string, emailed: boolean): string {
  return [
    `Hi ${name}, your (kalm) listing is ready.`,
    `Set your password here to open your dashboard: ${setPasswordUrl}`,
    `The link works for 3 days and can be used once.${emailed ? ' We have also sent it to your email.' : ''}`,
  ].join('\n\n');
}

// The message for the admin "Send on WhatsApp" button on a quote request
// (Admin > Leads). It NEVER carries the developer's name, phone or email
// (Hassan, 10 Nov 2026): the contractor opens the dashboard for those, where
// the free-plan lead cap applies as usual. Two levels, by the contractor's plan:
//  - Listed (free): work and area, then the dashboard link.
//  - Plus and Pro: also built-up area, budget and the details the developer
//    typed.
// The caller passes every free-text field already masked
// (maskContactDetails), so a number or email typed there cannot slip through.
export const WHATSAPP_DETAILS_MAX = 600;

export type QuoteWhatsappInput = {
  contractorName: string;
  tier: 'LISTED' | 'PLUS' | 'PRO';
  projectType: string;
  location: string;
  dashboardUrl: string;
  // Used for Plus and Pro only.
  request?: {
    budgetRangeLabel: string;
    builtUpArea: string | null;
    details: string;
  };
};

export function quoteRequestWhatsappText(input: QuoteWhatsappInput): string {
  const opening = `Hi ${input.contractorName}, you have a new quote request on (kalm).`;
  const work = [`Work: ${input.projectType}`, `Area: ${input.location}`];

  if (input.tier === 'LISTED' || !input.request) {
    return [opening, work.join('\n'), `Open your dashboard to see it and reply: ${input.dashboardUrl}`].join('\n\n');
  }

  const { request } = input;
  const details =
    request.details.length > WHATSAPP_DETAILS_MAX
      ? `${request.details.slice(0, WHATSAPP_DETAILS_MAX).trimEnd()}... (the rest is in your dashboard)`
      : request.details;
  if (request.builtUpArea) work.push(`Built-up area: ${request.builtUpArea}`);
  work.push(`Budget: ${request.budgetRangeLabel}`);

  return [
    opening,
    work.join('\n'),
    `Details: ${details}`,
    `Open your dashboard for the developer's contact details and to reply: ${input.dashboardUrl}`,
  ].join('\n\n');
}
