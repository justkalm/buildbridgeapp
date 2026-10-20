// scripts/merge-join-form-into-contractor.ts
//
// One-off admin tool (20 Oct 2026): copies ONE join form (/join) onto a
// contractor who already has a listing with the same email, because they
// signed up themself first. "Add as contractor" can't do this: it always
// makes a new listing, and the email is unique, so the save fails.
//
// What it does:
//   - adds the form's projects (name, developer, built-up area, photos) to
//     the existing listing, approved, as "Add a Contractor" would;
//   - fills the logo, bio and trades from the form ONLY where the listing
//     has none (it never overwrites what the contractor typed in);
//   - marks the join form ADDED.
// It never touches the email, password, phone, licence, GST or
// verification status.
//
// Refuses if the listing already has projects, so it can't double them.
//
//   npx tsx scripts/merge-join-form-into-contractor.ts <joinFormId>           dry run: shows what it would do, writes nothing
//   npx tsx scripts/merge-join-form-into-contractor.ts <joinFormId> --apply   writes
//
// The join form id is the long id in the /admin/applications link
// ("Add as contractor" opens /admin/contractors/new?from=<id>).

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { readJoinProjects } from '../src/lib/join-form';
import { contractorMember, opsConfigured, postOpsEvent } from '../src/lib/ops-sync';

async function main() {
  const formId = process.argv[2]?.trim();
  const apply = process.argv.includes('--apply');
  if (!formId || formId.startsWith('--')) {
    console.log('Usage: npx tsx scripts/merge-join-form-into-contractor.ts <joinFormId> [--apply]');
    process.exit(1);
  }

  const form = await prisma.contractorApplication.findUnique({ where: { id: formId } });
  if (!form) {
    console.log(`No join form found with the id ${formId}.`);
    process.exit(1);
  }
  if (form.status === 'ADDED') {
    console.log(`The join form of ${form.businessName} is already marked ADDED. Nothing to do.`);
    return;
  }

  const email = form.email.toLowerCase().trim();
  const contractor = await prisma.contractor.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      slug: true,
      bio: true,
      logoUrl: true,
      tradeTypes: true,
      phone: true,
      city: true,
      area: true,
      tier: true,
      licenseNumber: true,
      email: true,
      _count: { select: { projects: true } },
    },
  });
  if (!contractor) {
    console.log(`No listing has the email ${email}. Use "Add as contractor" on /admin/applications instead.`);
    process.exit(1);
  }
  if (contractor._count.projects > 0) {
    console.log(
      `${contractor.name} already has ${contractor._count.projects} project(s). Stopping, so nothing gets doubled. Add any missing ones by hand.`
    );
    process.exit(1);
  }

  const projects = readJoinProjects(form.projects);
  const fillLogo = !contractor.logoUrl && !!form.logoUrl;
  const fillBio = !contractor.bio?.trim() && !!form.bio?.trim();
  const fillTrades = contractor.tradeTypes.length === 0 && form.tradeTypes.length > 0;

  console.log(`Join form: ${form.businessName} (${form.email})`);
  console.log(`Listing:   ${contractor.name} (/contractors/${contractor.slug})`);
  console.log(`Projects to add: ${projects.length}`);
  for (const p of projects) {
    console.log(`  - ${p.name}${p.developerName ? `, for ${p.developerName}` : ''}, ${p.builtUpAreaSqft} sq ft, ${p.imageUrls.length} photo(s)`);
  }
  console.log(`Logo:   ${fillLogo ? 'will copy from the form' : 'left as it is'}`);
  console.log(`Bio:    ${fillBio ? 'will copy from the form' : 'left as it is'}`);
  console.log(`Trades: ${fillTrades ? `will set to ${form.tradeTypes.join(', ')}` : 'left as it is'}`);
  console.log('Join form will be marked ADDED.');

  if (!apply) {
    console.log('\nDry run: nothing written. Run again with --apply to write.');
    return;
  }

  await prisma.$transaction([
    prisma.contractor.update({
      where: { id: contractor.id },
      data: {
        ...(fillLogo ? { logoUrl: form.logoUrl } : {}),
        ...(fillBio ? { bio: form.bio } : {}),
        ...(fillTrades ? { tradeTypes: form.tradeTypes } : {}),
        projects: {
          create: projects.map((p) => ({
            title: p.name,
            developerName: p.developerName ?? null,
            squareFeet: p.builtUpAreaSqft,
            imageUrls: p.imageUrls,
            // Sent to us by the contractor on the join form and checked by
            // admin before this runs, same as "Add a Contractor" (KALM-252).
            approvalStatus: 'APPROVED' as const,
          })),
        },
      },
    }),
    prisma.contractorApplication.update({ where: { id: form.id }, data: { status: 'ADDED' } }),
  ]);
  console.log(`\nDone: ${projects.length} project(s) added to ${contractor.name}. Join form marked ADDED.`);

  // Trades show in the Operations app, so tell it if they changed.
  if (fillTrades && opsConfigured()) {
    const sent = await postOpsEvent('contractor.updated', contractorMember({ ...contractor, tradeTypes: form.tradeTypes }));
    console.log(sent ? 'Operations app updated.' : 'Could not update the Operations app (the website is fine).');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
