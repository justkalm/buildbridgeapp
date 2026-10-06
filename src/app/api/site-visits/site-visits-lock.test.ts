import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real site visit routes, with the database, login, email and push
// replaced by fakes. A site visit request is a lead: on the free plan the ones
// past the monthly five are LOCKED for the contractor (no contact details, and
// they cannot confirm, decline or cancel). The developer is never locked.

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  lockedLeadIdsAmong: vi.fn(),
  getSiteVisitForParty: vi.fn(),
  checkRateLimit: vi.fn(),
  requireVerified: vi.fn(),
  siteVisitFindMany: vi.fn(),
  siteVisitFindFirst: vi.fn(),
  siteVisitCreate: vi.fn(),
  siteVisitUpdate: vi.fn(),
  siteVisitUpdateMany: vi.fn(),
  contractorFindFirst: vi.fn(),
  developerFindUnique: vi.fn(),
  projectFindMany: vi.fn(),
  quoteRequestFindMany: vi.fn(),
  cancelledEmail: vi.fn(),
  requestEmail: vi.fn(),
  sendPush: vi.fn(),
  pending: [] as Promise<unknown>[],
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/quote-request-access', () => ({ lockedLeadIdsAmong: mocks.lockedLeadIdsAmong }));
vi.mock('@/lib/site-visit-access', () => ({ getSiteVisitForParty: mocks.getSiteVisitForParty, visitIcsFor: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock('@/lib/require-verified-email', () => ({ requireVerifiedDeveloperEmail: mocks.requireVerified }));
vi.mock('@/lib/email', () => ({
  sendSiteVisitCancelledEmail: mocks.cancelledEmail,
  sendSiteVisitConfirmedEmail: vi.fn(),
  sendSiteVisitDeclinedEmail: vi.fn(),
  sendSiteVisitRequestEmail: mocks.requestEmail,
}));
vi.mock('@/lib/push', () => ({ sendPush: mocks.sendPush }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    siteVisit: {
      findMany: mocks.siteVisitFindMany,
      findFirst: mocks.siteVisitFindFirst,
      create: mocks.siteVisitCreate,
      update: mocks.siteVisitUpdate,
      updateMany: mocks.siteVisitUpdateMany,
    },
    contractor: { findFirst: mocks.contractorFindFirst },
    developer: { findUnique: mocks.developerFindUnique },
    project: { findMany: mocks.projectFindMany },
    quoteRequest: { findMany: mocks.quoteRequestFindMany },
  },
}));
// after() normally runs a job once the response has gone out; here it runs it
// at once and keeps the promise so a test can wait for it.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (job: () => unknown) => {
    mocks.pending.push(Promise.resolve(job()));
  },
}));

import { PATCH } from './[id]/route';
import { GET } from './mine/route';
import { POST } from './route';

const visit = {
  id: 'v1',
  developerId: 'dev-1',
  contractorId: 'con-1',
  status: 'REQUESTED',
  confirmedSlot: null as Date | null,
  responseNote: null,
  createdAt: new Date('2026-10-02T10:00:00Z'),
  proposedSlots: [new Date(Date.now() + 3 * 86400_000)],
  projectIds: [],
  developer: { id: 'dev-1', name: 'Rahul', email: 'rahul@gmail.com' },
  contractor: { id: 'con-1', name: 'Alpha', email: 'alpha@example.com', phone: '9000000001', slug: 'alpha' },
};

const patch = (body: unknown) =>
  PATCH(new Request('http://localhost/api/site-visits/v1', { method: 'PATCH', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: 'v1' }),
  });
const settle = () => Promise.all(mocks.pending);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pending.length = 0;
  mocks.checkRateLimit.mockResolvedValue(true);
  mocks.siteVisitUpdateMany.mockResolvedValue({ count: 1 });
  mocks.cancelledEmail.mockResolvedValue(true);
  mocks.sendPush.mockResolvedValue(undefined);
});

describe('answering a site visit request (PATCH)', () => {
  it('a LOCKED visit cannot be declined, confirmed or cancelled by the contractor (403)', async () => {
    mocks.getSiteVisitForParty.mockResolvedValue({ visit, siteTitles: [], party: 'CONTRACTOR' });
    mocks.lockedLeadIdsAmong.mockResolvedValue(new Set(['v1']));
    for (const body of [{ action: 'decline' }, { action: 'cancel' }, { action: 'confirm', slot: visit.proposedSlots[0].toISOString(), meetingPoint: 'Gate 2' }]) {
      expect((await patch(body)).status).toBe(403);
    }
    expect(mocks.siteVisitUpdateMany).not.toHaveBeenCalled();
    expect(mocks.lockedLeadIdsAmong).toHaveBeenCalledWith('con-1', [{ id: 'v1', createdAt: visit.createdAt }]);
  });

  it('an unlocked visit can be declined by the contractor', async () => {
    mocks.getSiteVisitForParty.mockResolvedValue({ visit, siteTitles: [], party: 'CONTRACTOR' });
    mocks.lockedLeadIdsAmong.mockResolvedValue(new Set());
    expect((await patch({ action: 'decline' })).status).toBe(200);
    expect(mocks.siteVisitUpdateMany).toHaveBeenCalled();
  });

  it('a CONFIRMED visit is never locked: after a drop to the free plan the contractor can still cancel it', async () => {
    const confirmed = { ...visit, status: 'CONFIRMED', confirmedSlot: new Date(Date.now() + 2 * 86400_000) };
    mocks.getSiteVisitForParty.mockResolvedValue({ visit: confirmed, siteTitles: [], party: 'CONTRACTOR' });
    mocks.lockedLeadIdsAmong.mockResolvedValue(new Set(['v1']));
    expect((await patch({ action: 'cancel' })).status).toBe(200);
  });

  it('the developer can still cancel their own request, even when it is locked for the contractor', async () => {
    mocks.getSiteVisitForParty.mockResolvedValue({ visit, siteTitles: [], party: 'DEVELOPER' });
    mocks.lockedLeadIdsAmong.mockResolvedValue(new Set(['v1']));
    expect((await patch({ action: 'cancel' })).status).toBe(200);
  });

  it("a developer's cancel note never reaches the contractor's email while the visit is locked", async () => {
    mocks.getSiteVisitForParty.mockResolvedValue({ visit, siteTitles: [], party: 'DEVELOPER' });
    mocks.lockedLeadIdsAmong.mockResolvedValue(new Set(['v1']));
    await patch({ action: 'cancel', note: 'cancelling, call me on 98200 12345' });
    await settle();
    const email = mocks.cancelledEmail.mock.calls[0][0];
    expect(email.toEmail).toBe('alpha@example.com');
    expect(email.note).toBeNull();
    expect(JSON.stringify(email)).not.toContain('98200');
  });

  it('on an unlocked visit the developer\'s cancel note is passed on as usual', async () => {
    mocks.getSiteVisitForParty.mockResolvedValue({ visit, siteTitles: [], party: 'DEVELOPER' });
    mocks.lockedLeadIdsAmong.mockResolvedValue(new Set());
    await patch({ action: 'cancel', note: 'plans changed' });
    await settle();
    expect(mocks.cancelledEmail.mock.calls[0][0].note).toBe('plans changed');
  });
});

describe("a contractor's site visit list (GET /api/site-visits/mine)", () => {
  const dbVisit = (id: string, over: Record<string, unknown> = {}) => ({
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
    ...over,
  });
  const byId = (rows: { id: string }[], id: string) => rows.find((r) => r.id === id) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(() => {
    mocks.projectFindMany.mockResolvedValue([]);
    mocks.quoteRequestFindMany.mockResolvedValue([]);
    mocks.siteVisitFindMany.mockResolvedValue([dbVisit('v-full'), dbVisit('v-locked')]);
  });

  it('a locked visit comes back without email, phone or the unmasked note; an unlocked one is complete', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'con-1', role: 'contractor' } });
    mocks.lockedLeadIdsAmong.mockResolvedValue(new Set(['v-locked']));
    const rows = await (await GET()).json();
    const full = byId(rows, 'v-full');
    const locked = byId(rows, 'v-locked');

    expect(full.locked).toBe(false);
    expect(full.contactPhone).toBe('9820012345');
    expect(full.developer.email).toBe('rahul@gmail.com');

    expect(locked.locked).toBe(true);
    expect(locked.contactPhone).toBeNull();
    expect(locked.developer).toEqual({ name: 'Rahul' });
    expect(JSON.stringify(locked)).not.toContain('9820012345');
    expect(JSON.stringify(locked)).not.toContain('rahul@gmail.com');
  });

  it("a developer's cancel note on a locked visit is masked in the list", async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'con-1', role: 'contractor' } });
    mocks.siteVisitFindMany.mockResolvedValue([
      dbVisit('v-cancelled', { status: 'CANCELLED', cancelledBy: 'DEVELOPER', responseNote: 'cancelling, call me on 98200 12345' }),
    ]);
    mocks.lockedLeadIdsAmong.mockResolvedValue(new Set(['v-cancelled']));
    const [row] = await (await GET()).json();
    expect(row.locked).toBe(true);
    expect(row.responseNote).toBe('cancelling, call me on ••••');
    expect(JSON.stringify(row)).not.toContain('98200');
  });

  it('a CONFIRMED visit stays unlocked even if it is in the locked set (plan dropped after confirming)', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'con-1', role: 'contractor' } });
    mocks.siteVisitFindMany.mockResolvedValue([dbVisit('v-conf', { status: 'CONFIRMED', confirmedSlot: new Date('2026-10-20T10:00:00Z') })]);
    mocks.lockedLeadIdsAmong.mockResolvedValue(new Set(['v-conf']));
    const [row] = await (await GET()).json();
    expect(row.locked).toBe(false);
    expect(row.contactPhone).toBe('9820012345');
  });

  it('a developer is never locked and keeps their own request intact', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'dev-1', role: 'developer' } });
    const rows = await (await GET()).json();
    expect(rows[0].locked).toBeUndefined();
    expect(rows[0].contactPhone).toBe('9820012345');
    expect(mocks.lockedLeadIdsAmong).not.toHaveBeenCalled();
  });
});

describe('a new site visit request (POST): the email to the contractor', () => {
  const projects = ['p1', 'p2', 'p3'].map((id) => ({ id, title: `Tower ${id}` }));
  const slot = (days: number) => new Date(Date.now() + days * 86400_000).toISOString();
  const post = () =>
    POST(
      new Request('http://localhost/api/site-visits', {
        method: 'POST',
        body: JSON.stringify({
          contractorId: 'con-1',
          projectIds: ['p1', 'p2', 'p3'],
          slots: [slot(2), slot(3), slot(4)],
          contactPhone: '9820012345',
          note: 'Please call me on 9820012345 before coming',
        }),
      }) as never
    );

  beforeEach(() => {
    mocks.auth.mockResolvedValue({ user: { id: 'dev-1', role: 'developer' } });
    mocks.requireVerified.mockResolvedValue(null);
    mocks.contractorFindFirst.mockResolvedValue({ id: 'con-1', name: 'Alpha', email: 'alpha@example.com', passwordHash: 'x', projects });
    mocks.siteVisitFindFirst.mockResolvedValue(null);
    mocks.developerFindUnique.mockResolvedValue({ name: 'Rahul' });
    mocks.siteVisitCreate.mockResolvedValue({ id: 'v-new', createdAt: new Date() });
    mocks.siteVisitUpdate.mockResolvedValue({});
    mocks.requestEmail.mockResolvedValue(true);
  });

  it("a LOCKED request's email to the contractor leaves out the developer's own note", async () => {
    mocks.lockedLeadIdsAmong.mockResolvedValue(new Set(['v-new']));
    expect((await post()).status).toBe(200);
    expect(mocks.requestEmail.mock.calls[0][0].developerNote).toBeNull();
    expect(JSON.stringify(mocks.requestEmail.mock.calls[0][0])).not.toContain('9820012345');
  });

  it('an unlocked request carries the note as usual', async () => {
    mocks.lockedLeadIdsAmong.mockResolvedValue(new Set());
    await post();
    expect(mocks.requestEmail.mock.calls[0][0].developerNote).toContain('9820012345');
  });

  it('fails closed: if the lock check itself breaks, the note is left out and the request still goes through', async () => {
    mocks.lockedLeadIdsAmong.mockRejectedValue(new Error('database down'));
    expect((await post()).status).toBe(200);
    expect(mocks.requestEmail.mock.calls[0][0].developerNote).toBeNull();
  });
});
