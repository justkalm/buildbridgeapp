// scripts/sync-to-ops.ts
//
// One-off: sends every existing real contractor and developer to the (kalm)
// Operations app, so its member lists start complete. After this, the
// website keeps it up to date by itself (src/lib/ops-sync.ts).
//
// Safe to run again: the Operations app matches on the website ID, so a
// second run updates the same people and creates no duplicates. It sends
// 'updated', not 'signed_up', so people staff have set to Cancelled by hand
// in the Operations app are not switched back to Active.
//
//   npx tsx scripts/sync-to-ops.ts          dry run: counts only, sends nothing
//   npx tsx scripts/sync-to-ops.ts --send   sends
//
// Needs OPS_API_URL and OPS_API_KEY in .env. Demo contractors are skipped.
// Only reads the website database; it writes to the Operations app.

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { isDemoLicense } from '../src/lib/license';
import { contractorMember, developerMember, opsConfigured, postOpsEvent } from '../src/lib/ops-sync';

async function main() {
  const send = process.argv.includes('--send');

  const contractors = (
    await prisma.contractor.findMany({
      select: { id: true, name: true, email: true, phone: true, city: true, area: true, tradeTypes: true, tier: true, licenseNumber: true },
    })
  ).filter((c) => !isDemoLicense(c.licenseNumber));
  const developers = await prisma.developer.findMany({ select: { id: true, name: true, email: true, phone: true } });

  console.log(`Real contractors: ${contractors.length}. Developers: ${developers.length}. (Demo contractors skipped.)`);
  if (!send) {
    console.log('Dry run: nothing sent. Run again with --send to send.');
    return;
  }
  if (!opsConfigured()) {
    console.error('OPS_API_URL and OPS_API_KEY must both be set in .env. Nothing sent.');
    process.exitCode = 1;
    return;
  }

  let ok = 0;
  let failed = 0;
  for (const c of contractors) {
    if (await postOpsEvent('contractor.updated', contractorMember(c))) ok++;
    else failed++;
  }
  for (const d of developers) {
    if (await postOpsEvent('developer.updated', developerMember(d))) ok++;
    else failed++;
  }
  console.log(`Sent: ${ok}. Failed: ${failed}.`);
}

main().finally(() => prisma.$disconnect());
