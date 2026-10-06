import { describe, expect, it } from 'vitest';
import { buildLeadDetails, buildLedger, leadDetailsToCsv, ledgerToCsv, monthKeysDescending, type LedgerContractor, type LedgerRequest } from './lead-ledger';
import { getMonthRange, istMonthKey } from './lead-limits';

const free: LedgerContractor = { id: 'a', name: 'Alpha', tier: 'LISTED' };
const plus: LedgerContractor = { id: 'b', name: 'Beta', tier: 'PLUS' };
const req = (id: string, contractorId: string, status: LedgerRequest['status'] = 'PENDING'): LedgerRequest => ({ id, contractorId, status });

describe('buildLedger', () => {
  it('counts leads, replied, quoted, declined and waiting per contractor', () => {
    const { rows, totals } = buildLedger(
      [req('1', 'a'), req('2', 'a', 'QUOTED'), req('3', 'a', 'DECLINED'), req('4', 'a', 'CONTACTED'), req('5', 'b')],
      new Set(['1', '2']),
      [free, plus]
    );
    const a = rows.find((r) => r.contractorId === 'a')!;
    expect(a).toMatchObject({ leads: 4, replied: 2, quoted: 1, declined: 1, waiting: 0 });
    const b = rows.find((r) => r.contractorId === 'b')!;
    expect(b).toMatchObject({ leads: 1, replied: 0, waiting: 1 });
    expect(totals).toMatchObject({ leads: 5, replied: 2, quoted: 1, declined: 1, waiting: 1 });
  });

  it('counts Contacted separately: off-app contact by the contractor\'s own word', () => {
    const { rows } = buildLedger([req('1', 'a', 'CONTACTED'), req('2', 'a')], new Set(), [free]);
    expect(rows[0]).toMatchObject({ leads: 2, contacted: 1, replied: 0, waiting: 1 });
  });

  it('a Pending lead that has a reply is not waiting', () => {
    const { rows } = buildLedger([req('1', 'a')], new Set(['1']), [free]);
    expect(rows[0].waiting).toBe(0);
  });

  it('over free cap counts only leads past 5 for a Listed contractor', () => {
    const six = ['1', '2', '3', '4', '5', '6'].map((id) => req(id, 'a'));
    expect(buildLedger(six.slice(0, 5), new Set(), [free]).rows[0].overFreeCap).toBe(0);
    expect(buildLedger(six, new Set(), [free]).rows[0].overFreeCap).toBe(1);
    expect(buildLedger(six.map((r) => ({ ...r, contractorId: 'b' })), new Set(), [plus]).rows[0].overFreeCap).toBe(0);
  });

  it('sorts by most leads, then name, and skips unknown contractors', () => {
    const { rows } = buildLedger([req('1', 'b'), req('2', 'a'), req('3', 'a'), req('4', 'zzz')], new Set(), [free, plus]);
    expect(rows.map((r) => r.name)).toEqual(['Alpha', 'Beta']);
  });
});

describe('how leads arrived and email', () => {
  it('splits by quote form, message and project post', () => {
    const { rows, totals } = buildLedger(
      [
        { id: '1', contractorId: 'a', status: 'PENDING', kind: 'QUOTE' },
        { id: '2', contractorId: 'a', status: 'PENDING', kind: 'ENQUIRY' },
        { id: '3', contractorId: 'a', status: 'PENDING', kind: 'PROJECT' },
        { id: '4', contractorId: 'a', status: 'PENDING' },
      ],
      new Set(),
      [free]
    );
    expect(rows[0]).toMatchObject({ leads: 4, byQuote: 2, byEnquiry: 1, byProject: 1, emailFailed: 0 });
    expect(totals).toMatchObject({ byQuote: 2, byEnquiry: 1, byProject: 1 });
  });

  it('takes failed-email counts from the log per contractor', () => {
    const { rows, totals } = buildLedger(
      [req('1', 'a'), req('2', 'b')],
      new Set(),
      [free, plus],
      new Map([['a', 3]])
    );
    expect(rows.find((r) => r.contractorId === 'a')!.emailFailed).toBe(3);
    expect(rows.find((r) => r.contractorId === 'b')!.emailFailed).toBe(0);
    expect(totals.emailFailed).toBe(3);
  });
});

describe('ledgerToCsv', () => {
  it('neutralises spreadsheet formulas and quotes commas and quotes', () => {
    const { rows, totals } = buildLedger(
      [req('1', 'x'), req('2', 'y')],
      new Set(),
      [
        { id: 'x', name: '=HYPERLINK("http://evil")', tier: 'LISTED' },
        { id: 'y', name: 'Rao, Sons "Ltd"', tier: 'PRO' },
      ]
    );
    const csv = ledgerToCsv(rows, totals);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain('"Rao, Sons ""Ltd"""');
    expect(csv.split('\r\n')[0]).toBe('Contractor,Plan,Leads,Via quote form,Via message,Via project post,Failed emails,Replied,Marked contacted,Quoted,Declined,Still waiting,Over free cap');
    expect(csv.trimEnd().split('\r\n').pop()).toBe('Total,,2,2,0,0,0,0,0,0,0,2,0');
  });
});

describe('csv guard', () => {
  it('also neutralises leading line breaks, pipes and semicolons', () => {
    const { rows, totals } = buildLedger(
      [req('1', 'x'), req('2', 'y'), req('3', 'z')],
      new Set(),
      [
        { id: 'x', name: '\n=1+1', tier: 'LISTED' },
        { id: 'y', name: '|calc', tier: 'LISTED' },
        { id: 'z', name: ';x', tier: 'LISTED' },
      ]
    );
    const csv = ledgerToCsv(rows, totals);
    expect(csv).toContain("\"'\n=1+1\"");
    expect(csv).toContain("'|calc");
    expect(csv).toContain("';x");
  });
});

describe('month helpers', () => {
  it('range for October 2026 runs from 30 Sep 18:30 UTC to 31 Oct 18:30 UTC', () => {
    const r = getMonthRange('2026-10')!;
    expect(r.start.toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(r.end.toISOString()).toBe('2026-10-31T18:30:00.000Z');
  });
  it('December ends at the start of January in India time', () => {
    expect(getMonthRange('2026-12')!.end.toISOString()).toBe('2026-12-31T18:30:00.000Z');
  });
  it('rejects things that are not a month', () => {
    for (const bad of ['2026-13', '2026-00', '26-10', 'abc', '2026-1', '']) expect(getMonthRange(bad)).toBeNull();
  });
  it('istMonthKey follows India time at the boundary', () => {
    expect(istMonthKey(new Date('2026-09-30T18:29:00Z'))).toBe('2026-09');
    expect(istMonthKey(new Date('2026-09-30T18:30:00Z'))).toBe('2026-10');
  });
  it('lists months newest first across a year end', () => {
    expect(monthKeysDescending('2025-11', '2026-02')).toEqual(['2026-02', '2026-01', '2025-12', '2025-11']);
    expect(monthKeysDescending('2026-10', '2026-10')).toEqual(['2026-10']);
  });
});

describe('lead details', () => {
  const base = { contractorId: 'a', status: 'PENDING' as const, developerEmail: 'd@x.com' };
  it('lists newest first with plain-word mediums and the reply flag', () => {
    const d = buildLeadDetails(
      [
        { ...base, id: '1', kind: 'QUOTE', developerName: 'Dev One', createdAt: new Date('2026-10-02T10:00:00Z') },
        { ...base, id: '2', kind: 'ENQUIRY', developerName: 'Dev Two', createdAt: new Date('2026-10-05T10:00:00Z') },
        { ...base, id: '3', kind: 'PROJECT', developerName: 'Dev Three', createdAt: new Date('2026-10-03T10:00:00Z') },
      ],
      new Set(['2'])
    );
    expect(d.map((x) => [x.id, x.medium, x.repliedInApp])).toEqual([
      ['2', 'Message', true],
      ['3', 'Project post', false],
      ['1', 'Quote form', false],
    ]);
  });

  it('per-lead CSV shows India time and neutralises formulas in developer names', () => {
    const d = buildLeadDetails(
      [{ ...base, id: '1', kind: 'QUOTE', developerName: '+cmd|calc', createdAt: new Date('2026-09-30T18:30:00Z') }],
      new Set()
    );
    const csv = leadDetailsToCsv(d, [{ id: 'a', name: 'Alpha', tier: 'LISTED' }]);
    expect(csv).toContain("'+cmd|calc");
    expect(csv).toContain('2026-10-01 00:00');
    expect(csv.split('\r\n')[0]).toBe('Contractor,Developer,Developer email,Medium,Status,Replied in app,Received (India time)');
  });
});
