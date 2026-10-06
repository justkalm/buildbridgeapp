import { describe, expect, it } from 'vitest';
import { applyLeadVisibility, BLURRED_DETAILS_MAX_CHARS, maskContactDetails } from './lead-limits';

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

  it('leaves ordinary project figures alone', () => {
    const t = 'G+14 tower, 25000 sq ft per floor, 6 months, budget 2.5 Cr';
    expect(maskContactDetails(t)).toBe(t);
  });

  it('masks BEFORE cutting, so a number at the cut line cannot leak its first digits', () => {
    const text = 'a'.repeat(76) + ' 9820012345 is my number';
    const [r] = applyLeadVisibility('LISTED', monthStart, [{ id: 'lead-06' }, ...month(5)].slice(0, 0), [row(6, { id: 'lead-06', details: text })]);
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
