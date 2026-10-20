// src/app/api/admin/push/route.ts
//
// Admin phone alerts (20 Oct 2026). Signed-in admin only.
// POST: save this phone/browser for admin alerts (from "Turn on alerts on
// this phone" on the admin home). DELETE: stop admin alerts here. GET
// ?endpoint=...: is this device on the list (so the button shows the right
// state). DELETE only removes the admin row: the browser's own subscription
// is left alone, because the same device may also get personal
// notifications as a developer or contractor.
//
// POST and DELETE also insist the request came from this site
// (src/lib/same-origin.ts), like the other admin changes.
//
// Upserts on the endpoint, like /api/push/subscribe. Only https endpoints
// are accepted, which is what every real push service uses.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { isSameOrigin } from '@/lib/same-origin';

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith('https://').max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

function notAdmin() {
  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
}

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated())) return notAdmin();
  const endpoint = new URL(req.url).searchParams.get('endpoint');
  if (!endpoint) return NextResponse.json({ on: false });
  const row = await prisma.adminPushSubscription.findUnique({ where: { endpoint }, select: { id: true } });
  return NextResponse.json({ on: !!row });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  if (!(await isAdminAuthenticated())) return notAdmin();

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
  const origin = new URL(req.url).origin;

  await prisma.adminPushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, origin },
    update: { p256dh: keys.p256dh, auth: keys.auth, origin },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  if (!(await isAdminAuthenticated())) return notAdmin();
  const endpoint = (await req.json().catch(() => null))?.endpoint;
  if (typeof endpoint !== 'string') {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  }
  await prisma.adminPushSubscription.deleteMany({ where: { endpoint } });
  return NextResponse.json({ ok: true });
}
