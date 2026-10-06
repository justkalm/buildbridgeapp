import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real notifyNewMessage, with the database, email, push and blur check
// replaced by fakes, to prove WHAT would actually be sent. The point: a lead
// that is blurred for a free contractor must never put the developer's message
// (which can hold a phone number) into a push or an email.

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  sendPush: vi.fn(),
  sendNewMessageEmail: vi.fn(),
  blurredLeadIdsFor: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { quoteRequest: { findUnique: mocks.findUnique, update: mocks.update } } }));
vi.mock('@/lib/push', () => ({ sendPush: mocks.sendPush }));
vi.mock('@/lib/email', () => ({ sendNewMessageEmail: mocks.sendNewMessageEmail }));
vi.mock('@/lib/quote-request-access', () => ({ blurredLeadIdsFor: mocks.blurredLeadIdsFor }));

import { notifyNewMessage } from './message-notifications';
import { BLURRED_MESSAGE_NOTICE } from './notification-text';

const row = {
  kind: 'QUOTE',
  projectType: 'Waterproofing, call 9820012345',
  location: 'Thane',
  developerId: 'dev-1',
  contractorId: 'con-1',
  developerLastReadAt: null,
  contractorLastReadAt: null,
  developerNotifiedAt: null,
  contractorNotifiedAt: null,
  developer: { name: 'Rahul', email: 'rahul@example.com' },
  contractor: { name: 'Alpha Builders', email: 'alpha@example.com', passwordHash: 'x' },
};
const body = 'Hello, my number is 9820012345 please call me';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue(row);
  mocks.sendNewMessageEmail.mockResolvedValue(true);
  mocks.sendPush.mockResolvedValue(undefined);
  mocks.update.mockResolvedValue({ id: 'qr-1' });
});

describe('notifyNewMessage to a contractor', () => {
  it('blurred lead: the push and the email carry no preview and no number', async () => {
    mocks.blurredLeadIdsFor.mockResolvedValue(new Set(['qr-1']));
    await notifyNewMessage('qr-1', 'DEVELOPER', body);

    const push = mocks.sendPush.mock.calls[0][2];
    expect(push.body).toBe(BLURRED_MESSAGE_NOTICE);
    const email = mocks.sendNewMessageEmail.mock.calls[0][0];
    expect(email.preview).toBe(BLURRED_MESSAGE_NOTICE);
    expect(JSON.stringify([push, email])).not.toContain('9820012345');
  });

  it('full lead: the usual preview goes out', async () => {
    mocks.blurredLeadIdsFor.mockResolvedValue(new Set());
    await notifyNewMessage('qr-1', 'DEVELOPER', body);
    expect(mocks.sendPush.mock.calls[0][2].body).toContain('9820012345');
    expect(mocks.sendNewMessageEmail.mock.calls[0][0].preview).toContain('9820012345');
  });

  it('asks the blur check about THIS contractor', async () => {
    mocks.blurredLeadIdsFor.mockResolvedValue(new Set());
    await notifyNewMessage('qr-1', 'DEVELOPER', body);
    expect(mocks.blurredLeadIdsFor).toHaveBeenCalledWith('con-1');
  });
});

describe('notifyNewMessage to a developer', () => {
  it('a contractor reply always carries its preview (developers have no cap)', async () => {
    mocks.blurredLeadIdsFor.mockResolvedValue(new Set(['qr-1']));
    await notifyNewMessage('qr-1', 'CONTRACTOR', 'Happy to quote, call 9111111111');
    expect(mocks.sendPush.mock.calls[0][2].body).toContain('9111111111');
    expect(mocks.blurredLeadIdsFor).not.toHaveBeenCalled();
  });
});
