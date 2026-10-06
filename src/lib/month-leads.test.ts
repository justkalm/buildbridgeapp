import { beforeEach, describe, expect, it, vi } from 'vitest';

// monthLeadsFor is the ONE list the free-plan cap is decided from. It must
// read BOTH quote requests and site visits, for THIS contractor, since the
// start of the month, and return them oldest first.

const mocks = vi.hoisted(() => ({ qr: vi.fn(), sv: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { quoteRequest: { findMany: mocks.qr }, siteVisit: { findMany: mocks.sv } } }));

import { monthLeadsFor } from './month-leads';

const monthStart = new Date('2026-09-30T18:30:00Z');

beforeEach(() => vi.clearAllMocks());

describe('monthLeadsFor', () => {
  it('asks both tables for this contractor and this month, and merges them oldest first', async () => {
    mocks.qr.mockResolvedValue([{ id: 'q2', createdAt: new Date('2026-10-05T10:00:00Z') }, { id: 'q1', createdAt: new Date('2026-10-01T10:00:00Z') }]);
    mocks.sv.mockResolvedValue([{ id: 'v1', createdAt: new Date('2026-10-03T10:00:00Z') }]);

    const out = await monthLeadsFor('con-1', monthStart);

    expect(out.map((l) => l.id)).toEqual(['q1', 'v1', 'q2']);
    for (const m of [mocks.qr, mocks.sv]) {
      expect(m).toHaveBeenCalledWith({ where: { contractorId: 'con-1', createdAt: { gte: monthStart } }, select: { id: true, createdAt: true } });
    }
  });

  it('works when the contractor has only site visits, or nothing', async () => {
    mocks.qr.mockResolvedValue([]);
    mocks.sv.mockResolvedValue([{ id: 'v1', createdAt: new Date('2026-10-03T10:00:00Z') }]);
    expect((await monthLeadsFor('con-1', monthStart)).map((l) => l.id)).toEqual(['v1']);
    mocks.sv.mockResolvedValue([]);
    expect(await monthLeadsFor('con-1', monthStart)).toEqual([]);
  });
});
