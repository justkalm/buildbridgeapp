// scripts/normalize-locations.ts
//
// One-off script: rewrites every Contractor's city and area into the
// standard capitalisation from src/lib/location.ts ("mumbai" → "Mumbai",
// "andheri  west" → "Andheri West"). New saves are already normalized by
// the admin and contractor-profile routes; this tidies the rows saved
// before that rule existed, so profile pages and dashboards (not just the
// browse filters) show one consistent spelling.
//
// DRY RUN BY DEFAULT: prints what it would change and writes nothing.
// Add --apply to actually save:
//   npx tsx scripts/normalize-locations.ts           (preview)
//   npx tsx scripts/normalize-locations.ts --apply   (save)
//
// Safe to run more than once: rows that are already tidy are skipped.
// Deliberately does NOT touch verificationStatus. This is a formatting
// fix, not a change to where the contractor operates, so it shouldn't
// cost anyone their Verified badge. Blank locations are left blank and
// listed at the end, since there's nothing to capitalise and a real value
// has to come from the contractor or admin.

// Must come first: loads DATABASE_URL from .env. Next.js does this
// automatically for the app, but a standalone script run with tsx doesn't,
// and without it the Prisma client silently falls back to localhost.
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { normalizeLocation } from '../src/lib/location';

async function main() {
  const apply = process.argv.includes('--apply');

  const contractors = await prisma.contractor.findMany({
    select: { id: true, name: true, city: true, area: true },
    orderBy: { name: 'asc' },
  });

  const changes = contractors
    .map((c) => ({ ...c, newCity: normalizeLocation(c.city), newArea: normalizeLocation(c.area) }))
    .filter((c) => c.newCity !== c.city || c.newArea !== c.area);

  const blank = contractors.filter((c) => !c.city.trim() || !c.area.trim());

  console.log(`Checked ${contractors.length} contractors. ${changes.length} need tidying.\n`);
  for (const c of changes) {
    console.log(`  ${c.name}: "${c.area}, ${c.city}"  →  "${c.newArea}, ${c.newCity}"`);
  }

  if (apply && changes.length > 0) {
    for (const c of changes) {
      await prisma.contractor.update({
        where: { id: c.id },
        data: { city: c.newCity, area: c.newArea },
      });
    }
    console.log(`\nSaved ${changes.length} change(s).`);
  } else if (changes.length > 0) {
    console.log('\nPreview only, nothing was saved. Run again with --apply to save these changes.');
  }

  if (blank.length > 0) {
    console.log(`\n${blank.length} contractor(s) have no city or area set (not changed by this script):`);
    for (const c of blank) console.log(`  ${c.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
