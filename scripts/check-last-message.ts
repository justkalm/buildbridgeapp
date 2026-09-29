// scripts/check-last-message.ts
//
// Diagnostic: shows the most recent in-app message, who it was sent to,
// and whether that recipient has any device with notifications turned on.
// Read-only.
//
//   npx tsx scripts/check-last-message.ts

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const m = await prisma.message.findFirst({
    orderBy: { createdAt: 'desc' },
    select: {
      createdAt: true,
      senderRole: true,
      quoteRequest: {
        select: {
          kind: true,
          developer: { select: { id: true, name: true, email: true } },
          contractor: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!m) return console.log('No messages yet.');
  const q = m.quoteRequest;
  const toContractor = m.senderRole === 'DEVELOPER';
  const recipient = toContractor ? q.contractor : q.developer;
  const devices = await prisma.pushSubscription.count({
    where: { ownerRole: toContractor ? 'CONTRACTOR' : 'DEVELOPER', ownerId: recipient.id },
  });
  console.log(`\nLatest message: ${m.createdAt.toISOString()} (${q.kind})`);
  console.log(`  from ${toContractor ? 'developer' : 'contractor'}: ${toContractor ? q.developer.name : q.contractor.name}`);
  console.log(`  to   ${toContractor ? 'contractor' : 'developer'}: ${recipient.name} <${recipient.email}>`);
  console.log(`  devices with notifications on for the recipient: ${devices}`);

  const all = await prisma.pushSubscription.findMany({ select: { ownerRole: true, ownerId: true, createdAt: true } });
  console.log(`\nAll devices with notifications on: ${all.length}`);
  for (const s of all) {
    const who =
      s.ownerRole === 'DEVELOPER'
        ? await prisma.developer.findUnique({ where: { id: s.ownerId }, select: { name: true } })
        : await prisma.contractor.findUnique({ where: { id: s.ownerId }, select: { name: true } });
    console.log(`  • ${s.ownerRole.toLowerCase()}: ${who?.name ?? '?'} (since ${s.createdAt.toISOString()})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
