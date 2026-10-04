// prisma/fix-demo-areas.ts
//
// One-off tidy-up (5 Oct 2026). The platform is Mumbai only, but the demo
// contractors were seeded with two areas outside Mumbai: Thane and Vashi.
// This moves ONLY demo rows (licence starts DEMO/) to real Mumbai areas:
//   Thane -> Mulund      Vashi -> Govandi
// Real contractors are never touched.
//
// Safe by default: without --apply it only PRINTS what it would change.
//   npx tsx prisma/fix-demo-areas.ts            (preview, changes nothing)
//   npx tsx prisma/fix-demo-areas.ts --apply    (makes the change)

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const MOVES: Record<string, string> = { Thane: 'Mulund', Vashi: 'Govandi' };

async function main() {
  const apply = process.argv.includes('--apply');
  const rows = await prisma.contractor.findMany({
    where: { licenseNumber: { startsWith: 'DEMO/' }, area: { in: Object.keys(MOVES) } },
    select: { id: true, name: true, area: true },
  });
  console.log(`${rows.length} demo contractor(s) to move:`);
  for (const r of rows) console.log(`  ${r.name}: ${r.area} -> ${MOVES[r.area]}`);

  if (!apply) {
    console.log('\nPreview only. Nothing was changed. Add --apply to make the change.');
    return;
  }
  for (const r of rows) {
    await prisma.contractor.update({ where: { id: r.id }, data: { area: MOVES[r.area], city: 'Mumbai' } });
  }
  console.log(`\nDone. ${rows.length} row(s) updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
