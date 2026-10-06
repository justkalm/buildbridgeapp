import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real site visit routes, with the database, login, email and push
// replaced by fakes. A site visit request is a lead: on the free plan the ones
// past the monthly five are LOCKED for the contractor (no contact details, and
// they cannot confirm, decline or cancel). The developer is never locked.

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  blurredLeadIdsFor: vi.fn(),
  getSiteVisitForParty: vi.fn(),
  checkRateLimit: vi.fn(),
  siteVisitFindMany: vi.fn(),
  siteVisitUpdateMany: vi.fn(),
  projectFindMany: vi.fn(),
  quoteRequestFindMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/quote-request-access', () => ({ blurredLeadIdsFor: mocks.blurredLeadIdsFor }));
vi.mock('@/lib/site-visit-access', () => ({ getSiteVisitForParty: mocks.getSiteVisitForParty, visitIcsFor: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock('@/lib/email', () => ({
  sendSiteVisitCancelledEmail: vi.fn(),
  sendSiteVisitConfirmedEmail: vi.fn(),
  sendSiteVisitDeclinedEmail: vi.fn(),
}));
vi.mock('@/lib/push', () => ({ sendPush: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    siteVisit: { findMany: mocks.siteVisitFindMany, updateMany: mocks.siteVisitUpdateMany },
    project: { findMany: mocks.projectFindMany },
    quoteRequest: { findMany: mocks.quoteRequestFindMany },
  },
}));
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after: () => {} }));

import { PATCH } from './[id]/route';
import { GET } from './mine/route';

const visit = {
  id: 'v1',
  developerId: 'dev-1',
  contractorId: 'con-1',
  status: 'REQUESTED',
  proposedSlots: [new Date(Date.now() + 3 * 86400_000)],
  projectIds: [],
  developer: { id: 'dev-1', name: 'Rahul', email: 'rahul@gmail.com' },
  contractor: { id: 'con-1', name: 'Alpha', email: 'alpha@example.com', phone: '9000000001', slug: 'alpha' },
};

const patch = (body: unknown) =>
  PATCH(new Request('http://localhost/api/site-visits/v1', { method: 'PATCH', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: 'v1' }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue(true);
  mocks.siteVisitUpdateMany.mockResolvedValue({ count: 1 });
});

describe('answering a site visit request (PATCH)', () => {
  it('a LOCKED visit cannot be declined, confirmed or cancelled by the contractor (403)', async () => {
    mocks.getSiteVisitForParty.mockResolvedValue({ visit, siteTitles: [], party: 'CONTRACTOR' });
    mocks.blurredLeadIdsFor.mockResolvedValue(new Set(['v1']));
    for (const body of [{ action: 'decline' }, { action: 'cancel' }, { action: 'confirm', slot: visit.proposedSlots[0].toISOString(), meetingPoint: 'Gate 2' }]) {
      const res = await patch(body);
      expect(res.status).toBe(403);
    }
    expect(mocks.siteVisitUpdateMany).not.toHaveBeenCalled();
    expect(mocks.blurredLeadIdsFor).toHaveBeenCalledWith('con-1');
  });

  it('an unlocked visit can be declined by the contractor', async () => {
    mocks.getSiteVisitForParty.mockResolvedValue({ visit, siteTitles: [], party: 'CONTRACTOR' });
    mocks.blurredLeadIdsFor.mockResolvedValue(new Set());
    const res = await patch({ action: 'decline' });
    expect(res.status).toBe(200);
    expect(mocks.siteVisitUpdateMany).toHaveBeenCalled();
  });

  it('the developer can still cancel their own request, even when it is locked for the contractor', async () => {
    mocks.getSiteVisitForParty.mockResolvedValue({ visit, siteTitles: [], party: 'DEVELOPER' });
    mocks.blurredLeadIdsFor.mockResolvedValue(new Set(['v1']));
    const res = await patch({ action: 'cancel' });
    expect(res.status).toBe(200);
    expect(mocks.blurredLeadIdsFor).not.toHaveBeenCalled();
  });
});

describe("a contractor's site visit list (GET /api/site-visits/mine)", () => {
  const dbVisit = (id: string) => ({
    id,
    status: 'REQUESTED',
    projectIds: [],
    proposedSlots: [new Date('2026-10-20T10:00:00Z')],
    confirmedSlot: null,
    developerNote: 'Call me on 9820012345 please',
    contactPhone: '9820012345',
    meetingPoint: null,
    responseNote: null,
    cancelledBy: null,
    createdAt: new Date('2026-10-02T10:00:00Z'),
    respondedAt: null,
    contractorId: 'con-1',
    developerId: 'dev-1',
    lastActionAt: new Date('2026-10-02T10:00:00Z'),
    lastActionBy: 'DEVELOPER',
    developerSeenAt: null,
    contractorSeenAt: new Date('2026-10-03T10:00:00Z'),
    developer: { name: 'Rahul', email: 'rahul@gmail.com' },
    contractor: { name: 'Alpha', slug: 'alpha', phone: '9000000001' },
  });

  beforeEach(() => {
    mocks.projectFindMany.mockResolvedValue([]);
    mocks.quoteRequestFindMany.mockResolvedValue([]);
    mocks.siteVisitFindMany.mockResolvedValue([dbVisit('v-full'), dbVisit('v-locked')]);
  });

  it('a locked visit comes back without email, phone or the unmasked note; an unlocked one is complete', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'con-1', role: 'contractor' } });
    mocks.blurredLeadIdsFor.mockResolvedValue(new Set(['v-locked']));
    const res = await GET();
    const rows = await res.json();
    const full = rows.find((r: { id: string }) => r.id === 'v-full');
    const locked = rows.find((r: { id: string }) => r.id === 'v-locked');

    expect(full.locked).toBe(false);
    expect(full.contactPhone).toBe('9820012345');
    expect(full.developer.email).toBe('rahul@gmail.com');

    expect(locked.locked).toBe(true);
    expect(locked.contactPhone).toBeNull();
    expect(locked.developer).toEqual({ name: 'Rahul' });
    expect(JSON.stringify(locked)).not.toContain('9820012345');
    expect(JSON.stringify(locked)).not.toContain('rahul@gmail.com');
  });

  it('a developer is never locked and keeps their own request intact', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'dev-1', role: 'developer' } });
    const res = await GET();
    const rows = await res.json();
    expect(rows[0].locked).toBeUndefined();
    expect(rows[0].contactPhone).toBe('9820012345');
    expect(mocks.blurredLeadIdsFor).not.toHaveBeenCalled();
  });
});
