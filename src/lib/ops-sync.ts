// src/lib/ops-sync.ts
//
// Tells the (kalm) Operations app, our separate internal dashboard, when a
// contractor or developer signs up, changes, or is removed, so its member
// lists and Recent activity follow the website without anyone retyping.
//
// It is OFF until both settings exist in Vercel (and in .env for local):
//   OPS_API_URL  the Operations app's address, e.g. https://ops.example.com
//   OPS_API_KEY  the same long secret the Operations app holds as PLATFORM_API_KEY
// With either missing every call here does nothing.
//
// Rules this file keeps:
//  - Never slows or breaks the website. Calls run after the response is sent
//    (next/server `after`), time out in 5 seconds, and swallow every error.
//    Only the event type and the HTTP status are logged, never a name,
//    email or phone number.
//  - Sends who they are (name, email, phone, city, trades, plan) and nothing
//    else: no password data, no leads, no quote or message content.
//  - Sends no money. Plans are set by hand during the trial and nobody is
//    paying yet, so monthly_fee is deliberately never sent. Otherwise the
//    Operations app would count test Pro accounts as revenue (MRR).
//  - Demo contractors (licence starting DEMO/) are never sent.
//  - Only people who have proved their email are announced as sign-ups (the
//    verify-email routes send 'signed_up'), because the Operations app
//    matches on email and phone and would otherwise let anyone type
//    someone else's details at signup and overwrite a member staff added.

import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isDemoLicense } from '@/lib/license';
import { tradesOf } from '@/lib/trade-types';

export type OpsEventType =
  | 'contractor.signed_up'
  | 'contractor.updated'
  | 'contractor.cancelled'
  | 'developer.signed_up'
  | 'developer.updated';

export type OpsMember = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  trade?: string;
  tier?: 'Free' | 'Plus' | 'Pro';
};

const TIER_LABEL = { LISTED: 'Free', PLUS: 'Plus', PRO: 'Pro' } as const;

// The key travels in a header, so only https is accepted (plain http only for
// a local test on this machine).
export function opsConfigured(): boolean {
  const url = process.env.OPS_API_URL;
  if (!url || !process.env.OPS_API_KEY) return false;
  return url.startsWith('https://') || /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);
}

// Demo contractors are never sent.
export function shouldSyncContractor(licenseNumber: string): boolean {
  return !isDemoLicense(licenseNumber);
}

export function contractorMember(c: {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  area: string;
  tradeTypes: string[];
  tier: keyof typeof TIER_LABEL;
}): OpsMember {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    city: [c.area, c.city].filter(Boolean).join(', '),
    trade: tradesOf(c.tradeTypes).join(', ').slice(0, 300) || undefined,
    tier: TIER_LABEL[c.tier],
  };
}

export function developerMember(d: { id: string; name: string; email: string; phone: string | null }): OpsMember {
  return { id: d.id, name: d.name, email: d.email, phone: d.phone ?? undefined };
}

// One POST. Returns whether the Operations app accepted it. Never throws.
export async function postOpsEvent(type: OpsEventType, data: OpsMember): Promise<boolean> {
  if (!opsConfigured()) return false;
  try {
    const res = await fetch(`${process.env.OPS_API_URL!.replace(/\/+$/, '')}/api/platform/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPS_API_KEY}` },
      body: JSON.stringify({ type, data }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(`[ops-sync] ${type} rejected with status ${res.status}`);
    return res.ok;
  } catch {
    console.error(`[ops-sync] ${type} could not be delivered`);
    return false;
  }
}

// Load a contractor and send its current details, after the response.
export function syncContractorToOps(id: string, type: 'contractor.signed_up' | 'contractor.updated'): void {
  if (!opsConfigured()) return;
  after(async () => {
    try {
      const c = await prisma.contractor.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, phone: true, city: true, area: true, tradeTypes: true, tier: true, licenseNumber: true },
      });
      if (!c || !shouldSyncContractor(c.licenseNumber)) return;
      await postOpsEvent(type, contractorMember(c));
    } catch {
      console.error(`[ops-sync] ${type} could not be prepared`);
    }
  });
}

export function syncDeveloperToOps(id: string, type: 'developer.signed_up' | 'developer.updated'): void {
  if (!opsConfigured()) return;
  after(async () => {
    try {
      const d = await prisma.developer.findUnique({ where: { id }, select: { id: true, name: true, email: true, phone: true } });
      if (!d) return;
      await postOpsEvent(type, developerMember(d));
    } catch {
      console.error(`[ops-sync] ${type} could not be prepared`);
    }
  });
}

// A deleted contractor can no longer be loaded (so a demo cannot be told
// apart), and the Operations app creates a new Cancelled member if it is
// handed a name for someone it does not know. So only the ID is sent: it
// cancels a member it already knows and does nothing for an unknown one.
export function syncContractorRemovedToOps(id: string): void {
  if (!opsConfigured()) return;
  after(async () => {
    await postOpsEvent('contractor.cancelled', { id });
  });
}
