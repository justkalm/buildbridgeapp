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
// (Admin > Leads). Two levels, decided by the contractor's plan (10 Nov 2026):
//  - Listed (free): a nudge only. Work and area, then the dashboard link. No
//    developer name, phone, email, budget or details, so a WhatsApp can never
//    show more than the free-plan lead cap allows. The caller passes work and
//    area already masked (maskContactDetails), so a number typed there cannot
//    slip through either.
//  - Plus and Pro: the full request with the developer's phone and email.
//    These plans have no lead cap. The developer's name is left out (Hassan,
//    10 Nov 2026).
// dashboardUrl is null when the contractor has no login yet: the line about
// the dashboard is then left out.
export const WHATSAPP_DETAILS_MAX = 600;

export type QuoteWhatsappInput = {
  contractorName: string;
  tier: 'LISTED' | 'PLUS' | 'PRO';
  projectType: string;
  location: string;
  dashboardUrl: string | null;
  // Used for Plus and Pro only.
  lead?: {
    developerPhone: string;
    developerEmail: string;
    budgetRangeLabel: string;
    builtUpArea: string | null;
    details: string;
  };
};

export function quoteRequestWhatsappText(input: QuoteWhatsappInput): string {
  const opening = `Hi ${input.contractorName}, you have a new quote request on (kalm).`;
  const work = [`Work: ${input.projectType}`, `Area: ${input.location}`];

  if (input.tier === 'LISTED' || !input.lead) {
    return [
      opening,
      work.join('\n'),
      input.dashboardUrl ? `Open your dashboard to see it and reply: ${input.dashboardUrl}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  const { lead } = input;
  const details =
    lead.details.length > WHATSAPP_DETAILS_MAX
      ? `${lead.details.slice(0, WHATSAPP_DETAILS_MAX).trimEnd()}... (the rest is in your email and dashboard)`
      : lead.details;
  if (lead.builtUpArea) work.push(`Built-up area: ${lead.builtUpArea}`);
  work.push(`Budget: ${lead.budgetRangeLabel}`);

  return [
    opening,
    work.join('\n'),
    `Details: ${details}`,
    [`Phone: ${lead.developerPhone}`, `Email: ${lead.developerEmail}`].join('\n'),
    input.dashboardUrl ? `You can also reply from your dashboard: ${input.dashboardUrl}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}
