// src/app/api/push/subscribe/route.ts
//
// POST: save this browser/phone's push subscription for the signed-in
// developer or contractor, after they tap "Turn on notifications" and the
// browser grants permission. DELETE: remove it (they turned notifications
// off here). See src/lib/push.ts for how notifications are sent.
//
// Upserts on the endpoint: the same device re-subscribing (or a device
// that switched accounts) just updates the row, so a shared laptop never
// keeps notifying the previous account. Only https endpoints are accepted,
// which is what every real push service uses.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith('https://').max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

async function currentOwner() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  const id = session?.user?.id;
  if (!id || (role !== 'developer' && role !== 'contractor')) return null;
  return { ownerRole: role === 'developer' ? ('DEVELOPER' as const) : ('CONTRACTOR' as const), ownerId: id };
}

export async function POST(req: Request) {
  const owner = await currentOwner();
  if (!owner) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!checkRateLimit(`push-subscribe:${owner.ownerId}`, { maxAttempts: 20, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }
  const { endpoint, keys } = parsed.data;

  // Which website this device signed up on (see the origin comment on
  // PushSubscription in schema.prisma).
  const origin = new URL(req.url).origin;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { ...owner, endpoint, p256dh: keys.p256dh, auth: keys.auth, origin },
    update: { ...owner, p256dh: keys.p256dh, auth: keys.auth, origin },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const owner = await currentOwner();
  if (!owner) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const endpoint = (await req.json().catch(() => null))?.endpoint;
  if (typeof endpoint !== 'string') {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  }
  // Scoped to this owner, so nobody can unsubscribe someone else's device.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, ...owner } });
  return NextResponse.json({ ok: true });
}
