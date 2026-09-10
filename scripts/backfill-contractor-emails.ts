// scripts/backfill-contractor-emails.ts
//
// One-off script: fills in a placeholder email for any existing Contractor
// row with email = NULL, so the schema's new `email String @unique`
// (non-nullable) constraint can be applied via `prisma db push` without
// data loss. Safe to run multiple times — only touches rows that still
// have no email.
//
// Placeholder format matches the one already used in seed-demo.ts, derived
// from licenseNumber so it's guaranteed unique. These are NOT real
// addresses — contractors with a placeholder email cannot log in until
// admin or the contractor themselves sets a real one via signup/claim.

import { prisma } from '../src/lib/prisma';

// Raw SQL instead of prisma.contractor.findMany({ where: { email: null } }):
// the locally generated Prisma Client already reflects the NEW schema
// (email required), so its TypeScript types reject `null` as a valid
// filter value even though the actual database still has NULL rows at
// this point — that mismatch is expected mid-migration, and $queryRaw
// sidesteps it since it isn't type-checked against the schema.

type LegacyRow = { id: string; licenseNumber: string; name: string };

async function main() {
  const withoutEmail = await prisma.$queryRaw<LegacyRow[]>`
    SELECT id, "licenseNumber", name FROM "Contractor" WHERE email IS NULL
  `;

  console.log(`Found ${withoutEmail.length} contractors with no email.`);

  for (const c of withoutEmail) {
    const placeholder = `legacy.${c.licenseNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@placeholder.buildbridge.dev`;
    await prisma.$executeRaw`
      UPDATE "Contractor" SET email = ${placeholder} WHERE id = ${c.id}
    `;
    console.log(`  ${c.name} (${c.licenseNumber}) -> ${placeholder}`);
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
