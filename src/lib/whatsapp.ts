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
