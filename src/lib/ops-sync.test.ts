import { afterEach, describe, expect, it, vi } from 'vitest';
import { contractorMember, developerMember, opsConfigured, postOpsEvent, shouldSyncContractor } from './ops-sync';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('member shapes', () => {
  it('maps a contractor, with the plan as a label and no money', () => {
    const m = contractorMember({
      id: 'c1', name: 'ce Becho', email: 'a@b.in', phone: '99', city: 'Mumbai', area: 'Mazagaon',
      tradeTypes: [], tier: 'PRO',
    });
    expect(m).toMatchObject({ id: 'c1', name: 'ce Becho', city: 'Mazagaon, Mumbai', tier: 'Pro' });
    expect(m).not.toHaveProperty('monthly_fee');
  });
  it('maps a developer without a phone', () => {
    expect(developerMember({ id: 'd1', name: 'X', email: 'x@y.in', phone: null })).toEqual({
      id: 'd1', name: 'X', email: 'x@y.in', phone: undefined,
    });
  });
});

describe('postOpsEvent', () => {
  it('does nothing when it is not configured', async () => {
    vi.stubEnv('OPS_API_URL', '');
    vi.stubEnv('OPS_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(opsConfigured()).toBe(false);
    expect(await postOpsEvent('contractor.updated', { id: 'c1' })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('posts to the events endpoint with the bearer key', async () => {
    vi.stubEnv('OPS_API_URL', 'https://ops.example.com/');
    vi.stubEnv('OPS_API_KEY', 'k'.repeat(20));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    expect(await postOpsEvent('developer.signed_up', { id: 'd1', name: 'X' })).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://ops.example.com/api/platform/events');
    expect(init.headers.authorization).toBe(`Bearer ${'k'.repeat(20)}`);
    expect(JSON.parse(init.body)).toEqual({ type: 'developer.signed_up', data: { id: 'd1', name: 'X' } });
  });
  it('swallows a network failure', async () => {
    vi.stubEnv('OPS_API_URL', 'https://ops.example.com');
    vi.stubEnv('OPS_API_KEY', 'k'.repeat(20));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await postOpsEvent('contractor.updated', { id: 'c1' })).toBe(false);
  });
});

describe('rules', () => {
  it('never syncs a demo contractor', () => {
    expect(shouldSyncContractor('DEMO/0007')).toBe(false);
    expect(shouldSyncContractor('MH/2020/1234')).toBe(true);
    expect(shouldSyncContractor('PENDING-abc123')).toBe(true);
  });
  it('accepts only https, or http on this machine', () => {
    vi.stubEnv('OPS_API_KEY', 'k'.repeat(20));
    vi.stubEnv('OPS_API_URL', 'http://ops.example.com');
    expect(opsConfigured()).toBe(false);
    vi.stubEnv('OPS_API_URL', 'https://ops.example.com');
    expect(opsConfigured()).toBe(true);
    vi.stubEnv('OPS_API_URL', 'http://localhost:3001');
    expect(opsConfigured()).toBe(true);
  });
});
