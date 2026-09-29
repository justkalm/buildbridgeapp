// scripts/check-push.ts
//
// Diagnostic for "I turned notifications on but nothing pops up".
//   1. Checks the web push keys are set in .env.
//   2. Lists every device that has turned notifications on (which account,
//      which browser's push service, when), i.e. whether the "Turn on
//      notifications" click actually reached the database.
//   3. Sends ONE test notification to each device and prints the push
//      service's exact answer, so a refusal is visible instead of silent.
// Changes nothing, except removing devices the push service reports as
// gone (the same cleanup the app does on every send).
//
//   npx tsx scripts/check-push.ts

import 'dotenv/config';
import webpush from 'web-push';
import { prisma } from '../src/lib/prisma';

async function main() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  console.log('\n1) Push keys in .env:', publicKey && privateKey && subject ? 'present ✓' : 'MISSING ✗');
  if (!publicKey || !privateKey || !subject) return;
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const subs = await prisma.pushSubscription.findMany({ orderBy: { createdAt: 'desc' } });
  console.log(`\n2) Devices with notifications turned on: ${subs.length}`);
  if (subs.length === 0) {
    console.log('   → The "Turn on notifications" click never reached the database. The problem is in the browser step.');
    return;
  }

  for (const s of subs) {
    const owner =
      s.ownerRole === 'DEVELOPER'
        ? await prisma.developer.findUnique({ where: { id: s.ownerId }, select: { name: true, email: true } })
        : await prisma.contractor.findUnique({ where: { id: s.ownerId }, select: { name: true, email: true } });
    const service = new URL(s.endpoint).host;
    console.log(`\n   • ${s.ownerRole.toLowerCase()}: ${owner?.name ?? '(deleted account)'} <${owner?.email ?? '?'}>`);
    console.log(`     push service: ${service}, turned on ${s.createdAt.toISOString()}`);

    try {
      const res = await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: '(kalm) test notification', body: 'If you can see this, notifications work.', url: '/messages' })
      );
      console.log(`     3) test notification: accepted by push service ✓ (HTTP ${res.statusCode})`);
    } catch (err) {
      const e = err as { statusCode?: number; body?: string; message?: string };
      console.log(`     3) test notification: REFUSED ✗ (HTTP ${e.statusCode ?? '?'}) ${e.body ?? e.message ?? ''}`);
      if (e.statusCode === 404 || e.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        console.log('        (this device has unsubscribed, so it was removed)');
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
