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
  const lead = {
    developerName: 'Asha Developers',
    developerPhone: '98200 12345',
    developerEmail: 'asha@example.com',
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

  it('gives a free contractor the work, the area and the dashboard link, and nothing about the developer', () => {
    const text = quoteRequestWhatsappText({ ...base, tier: 'LISTED', lead });
    expect(text).toContain('Work: Waterproofing');
    expect(text).toContain('Area: Andheri West');
    expect(text).toContain(base.dashboardUrl);
    for (const hidden of [lead.developerName, lead.developerPhone, lead.developerEmail, lead.budgetRangeLabel, lead.builtUpArea, lead.details]) {
      expect(text).not.toContain(hidden);
    }
  });

  it('gives Plus and Pro the full request', () => {
    for (const tier of ['PLUS', 'PRO'] as const) {
      const text = quoteRequestWhatsappText({ ...base, tier, lead });
      for (const shown of [lead.developerName, lead.developerPhone, lead.developerEmail, lead.budgetRangeLabel, lead.builtUpArea, lead.details, base.dashboardUrl]) {
        expect(text).toContain(shown);
      }
    }
  });

  it('falls back to the short message when no lead details are passed', () => {
    expect(quoteRequestWhatsappText({ ...base, tier: 'PRO' })).not.toContain('From:');
  });

  it('leaves out the dashboard line when the contractor has no login yet', () => {
    const text = quoteRequestWhatsappText({ ...base, tier: 'PRO', lead, dashboardUrl: null });
    expect(text).not.toContain('dashboard:');
    expect(text).toContain(lead.developerPhone);
  });

  it('shortens very long details and uses no long dash', () => {
    const text = quoteRequestWhatsappText({ ...base, tier: 'PRO', lead: { ...lead, details: 'x'.repeat(2000) } });
    expect(text).not.toContain('x'.repeat(WHATSAPP_DETAILS_MAX + 1));
    expect(text).toContain('the rest is in your email and dashboard');
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
