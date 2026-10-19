import { describe, expect, it } from 'vitest';
import { loginLinkWhatsappText, whatsappMessageLink } from './whatsapp';

describe('whatsappMessageLink', () => {
  it('fills the message in for a clear Indian mobile number', () => {
    expect(whatsappMessageLink('98200 12345', 'Hi & bye')).toBe('https://wa.me/919820012345?text=Hi%20%26%20bye');
  });

  it('gives no link when the number is unclear', () => {
    expect(whatsappMessageLink('12345', 'Hi')).toBeNull();
  });
});

describe('loginLinkWhatsappText', () => {
  it('carries the link and mentions the email only when it went', () => {
    const url = 'https://app.justkalm.in/reset-password?token=abc&role=contractor&welcome=1';
    expect(loginLinkWhatsappText('Giriraj', url, true)).toContain(url);
    expect(loginLinkWhatsappText('Giriraj', url, true)).toContain('also sent it to your email');
    expect(loginLinkWhatsappText('Giriraj', url, false)).not.toContain('email');
  });
});
