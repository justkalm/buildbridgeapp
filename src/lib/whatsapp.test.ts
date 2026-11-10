import { describe, expect, it } from 'vitest';
import { WHATSAPP_DETAILS_MAX, loginLinkWhatsappText, quoteRequestWhatsappText, whatsappMessageLink } from './whatsapp';

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

describe('quoteRequestWhatsappText', () => {
  const request = {
    budgetRangeLabel: 'Rs. 12,50,000',
    builtUpArea: '30,000 sq ft',
    details: 'Terrace waterproofing for two wings.',
  };
  const base = {
    contractorName: 'Giriraj',
    projectType: 'Waterproofing',
    location: 'Andheri West',
    dashboardUrl: 'https://justkalm.in/contractor/dashboard',
  };

  it('gives a free contractor the work, the area and the dashboard link only', () => {
    const text = quoteRequestWhatsappText({ ...base, tier: 'LISTED', request });
    expect(text).toContain('Work: Waterproofing');
    expect(text).toContain('Area: Andheri West');
    expect(text).toContain(base.dashboardUrl);
    for (const hidden of [request.budgetRangeLabel, request.builtUpArea, request.details]) {
      expect(text).not.toContain(hidden);
    }
  });

  it('gives Plus and Pro the budget, area and details too', () => {
    for (const tier of ['PLUS', 'PRO'] as const) {
      const text = quoteRequestWhatsappText({ ...base, tier, request });
      for (const shown of [request.budgetRangeLabel, request.builtUpArea, request.details, base.dashboardUrl]) {
        expect(text).toContain(shown);
      }
    }
  });

  it('never has a line for the developer name, phone or email, on any plan', () => {
    for (const tier of ['LISTED', 'PLUS', 'PRO'] as const) {
      const text = quoteRequestWhatsappText({ ...base, tier, request });
      expect(text).not.toMatch(/^(From|Phone|Email):/m);
    }
  });

  it('falls back to the short message when no request details are passed', () => {
    expect(quoteRequestWhatsappText({ ...base, tier: 'PRO' })).not.toContain('Details:');
  });

  it('shortens very long details and uses no long dash', () => {
    const text = quoteRequestWhatsappText({ ...base, tier: 'PRO', request: { ...request, details: 'x'.repeat(2000) } });
    expect(text).not.toContain('x'.repeat(WHATSAPP_DETAILS_MAX + 1));
    expect(text).toContain('the rest is in your dashboard');
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
