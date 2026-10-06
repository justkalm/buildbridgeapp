import { describe, expect, it } from 'vitest';
import { buildContractorReport, reportToText, type ReportRequest } from './lead-report';

const lead = (i: number, over: Partial<ReportRequest> = {}): ReportRequest => ({
  id: String(i),
  status: 'PENDING',
  kind: 'QUOTE',
  createdAt: new Date(Date.UTC(2026, 9, i + 1, 10)),
  developerName: `Dev ${i}`,
  projectType: 'Waterproofing',
  location: 'Thane',
  ...over,
});

describe('buildContractorReport', () => {
  it('counts how leads arrived, where, and what happened', () => {
    const r = buildContractorReport(
      [
        lead(1),
        lead(2, { kind: 'ENQUIRY', location: ' thane ', status: 'QUOTED' }),
        lead(3, { kind: 'PROJECT', location: 'Andheri', projectType: 'Fire safety', status: 'CONTACTED' }),
        lead(4, { status: 'DECLINED', location: '' }),
      ],
      new Set(['2']),
      'PRO',
      true
    );
    expect(r.total).toBe(4);
    expect(r.byMedium).toEqual([
      { label: 'Quote form', count: 2 },
      { label: 'Message', count: 1 },
      { label: 'Project post', count: 1 },
    ]);
    expect(r.byLocation[0]).toEqual({ label: 'Thane', count: 2 });
    expect(r.byLocation.map((t) => t.label)).toContain('Not given');
    expect(r).toMatchObject({ repliedInApp: 1, contacted: 1, quoted: 1, declined: 1, waiting: 1, hiddenCount: 0 });
  });

  it('lists newest first', () => {
    const r = buildContractorReport([lead(1), lead(5), lead(3)], new Set(), 'PLUS', true);
    expect(r.leads.map((l) => l.id)).toEqual(['5', '3', '1']);
  });

  it('free plan: leads past the 5th this month have contacts hidden, oldest five stay full', () => {
    const seven = [1, 2, 3, 4, 5, 6, 7].map((i) => lead(i));
    const r = buildContractorReport(seven, new Set(), 'LISTED', true);
    expect(r.hiddenCount).toBe(2);
    expect(r.leads.filter((l) => l.contactsHidden).map((l) => l.id).sort()).toEqual(['6', '7']);
  });

  it('past months are never hidden, and paid plans never are', () => {
    const seven = [1, 2, 3, 4, 5, 6, 7].map((i) => lead(i));
    expect(buildContractorReport(seven, new Set(), 'LISTED', false).hiddenCount).toBe(0);
    expect(buildContractorReport(seven, new Set(), 'PRO', true).hiddenCount).toBe(0);
  });

  it('never carries developer email, phone or details (the shape has no such fields)', () => {
    const r = buildContractorReport([lead(1)], new Set(), 'LISTED', true);
    expect(Object.keys(r.leads[0]).sort()).toEqual(
      ['contactsHidden', 'developerName', 'id', 'location', 'medium', 'projectType', 'receivedAt', 'repliedInApp', 'status'].sort()
    );
  });

  it('plain text mentions the free-plan note only when leads were hidden', () => {
    const seven = [1, 2, 3, 4, 5, 6, 7].map((i) => lead(i));
    const text = reportToText(buildContractorReport(seven, new Set(), 'LISTED', true), 'Alpha', '2026-10');
    expect(text).toContain('October 2026');
    expect(text).toContain('Leads received: 7');
    expect(text).toContain('2 leads this month came after the 5 full leads');
    const none = reportToText(buildContractorReport([lead(1)], new Set(), 'PRO', true), 'Alpha', '2026-10');
    expect(none).not.toContain('came after');
  });
});
