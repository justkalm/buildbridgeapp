import { describe, expect, it } from 'vitest';
import { applyLeadVisibility, BLURRED_DETAILS_MAX_CHARS, maskContactDetails } from './lead-limits';
import { BLURRED_MESSAGE_NOTICE, notificationTextFor } from './notification-text';

// What the contractor dashboard may receive. These tests exist because the
// blur is a revenue rule AND a privacy rule: a free contractor must never get a
// developer's email or phone for a lead past their five a month.

const monthStart = new Date('2026-09-30T18:30:00Z'); // 1 Oct 2026, India time

type Row = {
  id: string;
  createdAt: Date;
  details: string;
  kind: string;
  developer: { name: string; email: string | null; phone: string | null };
  contactPhone?: string;
};

const row = (n: number, over: Partial<Row> = {}): Row => ({
  id: `lead-${String(n).padStart(2, '0')}`,
  createdAt: new Date(monthStart.getTime() + n * 3600_000),
  details: 'Need waterproofing for a 14 floor tower, call me on 9000000000',
  kind: 'QUOTE',
  developer: { name: `Dev ${n}`, email: `dev${n}@example.com`, phone: `90000000${String(n).padStart(2, '0')}` },
  ...over,
});

const month = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `lead-${String(i + 1).padStart(2, '0')}` }));
const rowsFor = (n: number) => Array.from({ length: n }, (_, i) => row(i + 1));

describe('applyLeadVisibility, free plan', () => {
  const out = applyLeadVisibility('LISTED', monthStart, month(7), rowsFor(7));
  const full = out.filter((r) => r.leadVisibility === 'full');
  const blurred = out.filter((r) => r.leadVisibility === 'blurred');

  it('keeps the oldest five full, with the developer contact details', () => {
    expect(full.map((r) => r.id)).toEqual(['lead-01', 'lead-02', 'lead-03', 'lead-04', 'lead-05']);
    for (const r of full) {
      expect(r.developer.email).toMatch(/@example\.com$/);
      expect(r.developer.phone).toBeTruthy();
    }
  });

  it('never shows more than five in full', () => {
    expect(full).toHaveLength(5);
  });

  it('blurred leads carry NO developer email or phone anywhere in the row', () => {
    expect(blurred.map((r) => r.id)).toEqual(['lead-06', 'lead-07']);
    for (const r of blurred) {
      expect(r.developer.email).toBeNull();
      expect(r.developer.phone).toBeNull();
      const json = JSON.stringify(r);
      expect(json).not.toContain('@example.com');
      expect(json).not.toMatch(/9000000\d{3}/);
    }
  });

  it('keeps the developer name and the project basics on blurred leads, as the dashboard does', () => {
    expect(blurred[0].developer.name).toBe('Dev 6');
    expect(blurred[0].kind).toBe('QUOTE');
  });

  it('cuts the details of a blurred lead to 80 characters (the text can hold a number or address)', () => {
    const long = 'x'.repeat(200);
    const [r] = applyLeadVisibility('LISTED', monthStart, month(6), [row(6, { details: long })]);
    expect(r.leadVisibility).toBe('blurred');
    expect(r.details).toBe('x'.repeat(BLURRED_DETAILS_MAX_CHARS) + '…');
  });

  it('leaves a short blurred detail text as it is (exactly 80 is not cut)', () => {
    const exact = 'y'.repeat(BLURRED_DETAILS_MAX_CHARS);
    const [r] = applyLeadVisibility('LISTED', monthStart, month(6), [row(6, { details: exact })]);
    expect(r.details).toBe(exact);
  });

  it('drops a contactPhone field from a blurred row even if some future query fetches it', () => {
    const [r] = applyLeadVisibility('LISTED', monthStart, month(6), [row(6, { contactPhone: '9111111111' })]);
    expect(r.leadVisibility).toBe('blurred');
    expect('contactPhone' in r).toBe(false);
    expect(JSON.stringify(r)).not.toContain('9111111111');
  });
});

describe('maskContactDetails (the preview text of a blurred lead)', () => {
  it('masks phone numbers however they are typed', () => {
    for (const t of ['call 9820012345 now', 'call 98200 12345 now', 'call +91 98200 12345 now', 'call 98200-12345 now', 'call (022) 2345 6789 now']) {
      const out = maskContactDetails(t);
      expect(out).toContain('••••');
      expect(out).not.toMatch(/\d{4}/);
    }
  });

  it('masks email addresses', () => {
    expect(maskContactDetails('mail me at rahul.k+site@gmail.co.in please')).toBe('mail me at •••• please');
  });

  it('masks slash-separated numbers, Hindi digits and numbers hidden with zero-width characters', () => {
    for (const t of ['98200/12345', '\u096F\u096E\u0968\u0966\u0966\u0967\u0968\u0969\u096A\u096B', '98200\u200B12345', '\uFF19\uFF18\uFF12\uFF10\uFF10\uFF11\uFF12\uFF13\uFF14\uFF15']) {
      const out = maskContactDetails(`ring ${t} soon`);
      expect(out).toBe('ring •••• soon');
    }
  });

  it('masks emails written with spaces, brackets or words', () => {
    for (const t of ['rahul @ gmail.com', 'rahul[at]gmail.com', 'rahul(at)gmail(dot)com', 'rahul@gmail .com', 'rahul at gmail dot com']) {
      expect(maskContactDetails(`mail ${t} please`)).toBe('mail •••• please');
    }
  });

  it('does NOT mask ranges, dates or ordinary figures', () => {
    for (const t of [
      '1200 - 1500 sqft', '3.5 - 4.5 Cr', '07-10-2026', '2026-10-07', '15.10.2026', '25,00,000', 'Rs. 1,25,00,000 budget',
      'size 30 x 40 (1200)', '40 - 50 lakh', 'G+14 tower', 'PIN 400001', 'meet at the site, look at plan. floors 12',
    ]) {
      expect(maskContactDetails(t)).toBe(t);
    }
  });

  it('is fast on long input (no catastrophic backtracking)', () => {
    const nasty = ('1 '.repeat(5000)) + 'a'.repeat(5000) + '@';
    const t0 = Date.now();
    maskContactDetails(nasty);
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it('leaves ordinary project figures alone', () => {
    const t = 'G+14 tower, 25000 sq ft per floor, 6 months, budget 2.5 Cr';
    expect(maskContactDetails(t)).toBe(t);
  });

  it('masks BEFORE cutting, so a number at the cut line cannot leak its first digits', () => {
    const text = 'a'.repeat(76) + ' 9820012345 is my number';
    const [r] = applyLeadVisibility('LISTED', monthStart, month(6), [row(6, { details: text })]);
    expect(r.leadVisibility).toBe('blurred');
    expect(r.details).not.toMatch(/\d{3}/);
  });
});

describe('applyLeadVisibility, other cases', () => {
  it('paid plans see every lead in full', () => {
    for (const tier of ['PLUS', 'PRO'] as const) {
      const out = applyLeadVisibility(tier, monthStart, month(9), rowsFor(9));
      expect(out.every((r) => r.leadVisibility === 'full')).toBe(true);
      expect(out.every((r) => r.developer.email !== null)).toBe(true);
    }
  });

  it('a lead from an earlier month is never blurred for a free contractor', () => {
    const old = row(1, { id: 'old-1', createdAt: new Date(monthStart.getTime() - 86400_000) });
    const [r] = applyLeadVisibility('LISTED', monthStart, month(8), [old]);
    expect(r.leadVisibility).toBe('full');
    expect(r.developer.email).not.toBeNull();
  });

  it('fails closed: a current-month lead missing from the month list is blurred for a free contractor', () => {
    const [r] = applyLeadVisibility('LISTED', monthStart, [], [row(1)]);
    expect(r.leadVisibility).toBe('blurred');
    expect(r.developer.email).toBeNull();
  });

  it('a lead missing from the month list stays full on a paid plan', () => {
    const [r] = applyLeadVisibility('PRO', monthStart, [], [row(1)]);
    expect(r.leadVisibility).toBe('full');
  });

  it('decides the free five from the whole month even when only the newest are displayed', () => {
    const all = month(60);
    const newest50 = rowsFor(60).slice(-50);
    const out = applyLeadVisibility('LISTED', monthStart, all, newest50);
    expect(out.every((r) => r.leadVisibility === 'blurred')).toBe(true);
    expect(out.every((r) => r.developer.email === null)).toBe(true);
  });

  it('does not change the input rows', () => {
    const input = rowsFor(7);
    const copy = JSON.parse(JSON.stringify(input));
    applyLeadVisibility('LISTED', monthStart, month(7), input);
    expect(JSON.parse(JSON.stringify(input))).toEqual(copy);
  });
});

describe('free text on a blurred lead (project type and area)', () => {
  it('masks a number typed into the project type or the area of a blurred lead', () => {
    const [r] = applyLeadVisibility('LISTED', monthStart, month(6), [
      row(6, { projectType: 'Waterproofing call 98200 12345', location: 'Thane, ring 9820012345' } as Partial<Row>),
    ] as never);
    const out = r as unknown as { projectType: string; location: string; leadVisibility: string };
    expect(out.leadVisibility).toBe('blurred');
    expect(out.projectType).toBe('Waterproofing call ••••');
    expect(out.location).toBe('Thane, ring ••••');
  });

  it('leaves the project type and area of a FULL lead exactly as typed', () => {
    const [r] = applyLeadVisibility('LISTED', monthStart, month(6), [
      row(1, { projectType: 'Waterproofing call 98200 12345' } as Partial<Row>),
    ] as never);
    expect((r as unknown as { projectType: string }).projectType).toBe('Waterproofing call 98200 12345');
  });
});

describe('push and email text for a new message (notificationTextFor)', () => {
  const body = 'Hi, my number is 9820012345, please call';

  it('a blurred lead gets NO preview of the message, only a notice', () => {
    const { preview, title } = notificationTextFor(true, body, 'Fire safety, call 9820012345');
    expect(preview).toBe(BLURRED_MESSAGE_NOTICE);
    expect(preview).not.toContain('9820012345');
    expect(title).toBe('Fire safety, call ••••');
  });

  it('a full lead (or a message to a developer) gets the usual preview', () => {
    const { preview, title } = notificationTextFor(false, body, 'Fire safety');
    expect(preview).toContain('9820012345');
    expect(title).toBe('Fire safety');
  });
});
