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
