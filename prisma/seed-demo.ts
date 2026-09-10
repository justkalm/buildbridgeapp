// prisma/seed-demo.ts
//
// Generates 50 FAKE contractors with 3-5 projects each (7-10 placeholder
// photos per project) for populating the browse/filter/sort UI with
// enough volume to actually test against. This is entirely synthetic
// data — fake names, fake license numbers, fake everything — and is
// SEPARATE from prisma/seed.ts, which is for your real contractors.
//
// All 50 are marked VERIFIED, not because they've been checked (they
// haven't — they don't exist), but because the browse page only shows
// VERIFIED contractors and the whole point of this script is to see them
// there while testing. DO NOT leave this data in before a real launch —
// showing fake "Verified" badges to real visitors is exactly the kind of
// thing the badge is supposed to prevent. Clean these out with:
//   npx tsx prisma/seed-demo.ts --clean
// before going live.
//
// Images are placeholder URLs from picsum.photos (a free, no-auth-needed
// placeholder image service) — nothing gets uploaded to Vercel Blob for
// this, so running this script doesn't touch your storage or its quota.
// Each URL includes a fixed seed number so the same "photo" reliably
// reappears on reload instead of changing every request.
//
// Run with: npx tsx prisma/seed-demo.ts

import 'dotenv/config';
import { PrismaClient, VerificationStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_LICENSE_PREFIX = 'DEMO/';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickMultiple<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function placeholderImages(count: number, seedPrefix: string): string[] {
  return Array.from({ length: count }, (_, i) => `https://picsum.photos/seed/${seedPrefix}-${i}/800/600`);
}

const FIRST_NAMES = [
  'Kunal', 'Rohan', 'Amit', 'Vikram', 'Sanjay', 'Rajesh', 'Suresh', 'Manoj',
  'Deepak', 'Anil', 'Prakash', 'Ravi', 'Ashok', 'Nitin', 'Sunil', 'Vinod',
  'Ajay', 'Rakesh', 'Mahesh', 'Dinesh',
];
const LAST_NAMES = [
  'Raut', 'Sharma', 'Patil', 'Shah', 'Desai', 'Joshi', 'Mehta', 'Kulkarni',
  'Chavan', 'Pandey', 'Verma', 'Reddy', 'Nair', 'Iyer', 'Gupta', 'Bhatt',
  'Rane', 'Salunkhe', 'Kadam', 'Naik',
];
const BUSINESS_SUFFIXES = ['Constructions', 'Builders', 'Infra', 'Contractors', 'Projects', 'Enterprises'];

const AREAS: { city: string; area: string }[] = [
  { city: 'Mumbai', area: 'Thane' },
  { city: 'Mumbai', area: 'Andheri West' },
  { city: 'Mumbai', area: 'Bandra' },
  { city: 'Mumbai', area: 'Powai' },
  { city: 'Mumbai', area: 'Mazagaon' },
  { city: 'Mumbai', area: 'Borivali' },
  { city: 'Mumbai', area: 'Chembur' },
  { city: 'Mumbai', area: 'Vashi' },
  { city: 'Mumbai', area: 'Kandivali' },
  { city: 'Mumbai', area: 'Dadar' },
];

const TRADES = [
  'RCC & Structural', 'Electrical', 'Waterproofing', 'Interior Fit-out',
  'Plumbing', 'Facade & Cladding',
];

const PROJECT_TYPES = ['Residential', 'Commercial', 'Industrial', 'Mixed-use'];

function generateContractor(index: number) {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const suffix = pick(BUSINESS_SUFFIXES);
  const name = `${first} ${last} ${suffix}`;
  const { city, area } = pick(AREAS);
  const tradeTypes = pickMultiple(TRADES, randomInt(1, 3));
  const projectCount = randomInt(3, 5);

  const projects = Array.from({ length: projectCount }, (_, i) => {
    const imageCount = randomInt(7, 10);
    return {
      title: `${pick(['Sunrise', 'Emerald', 'Silver', 'Golden', 'Royal', 'Crystal', 'Horizon', 'Skyline'])} ${pick(['Heights', 'Residency', 'Towers', 'Enclave', 'Park', 'Plaza'])}`,
      developerName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} Developers`,
      projectType: `${pick(PROJECT_TYPES)}, G+${randomInt(4, 24)}`,
      completedYear: randomInt(2018, 2025),
      squareFeet: randomInt(15000, 250000),
      elevationFloors: randomInt(4, 24),
      committedDurationMonths: randomInt(12, 36),
      actualDurationMonths: randomInt(12, 40),
      imageUrls: placeholderImages(imageCount, `${slugify(name)}-p${i}`),
    };
  });

  return {
    name,
    city,
    area,
    tradeTypes,
    licenseNumber: `${DEMO_LICENSE_PREFIX}${String(index).padStart(4, '0')}`,
    // Placeholder email — required + unique on Contractor now that the
    // dashboard needs a login identity. These are demo/load-test rows with
    // no real passwordHash, so they can never actually log in; the email
    // just satisfies the unique constraint.
    email: `demo.contractor.${index}@placeholder.buildbridge.dev`,
    verificationStatus: 'VERIFIED' as VerificationStatus,
    yearsInBusiness: randomInt(3, 35),
    teamSizeMin: randomInt(5, 30),
    teamSizeMax: randomInt(31, 150),
    gstRegistered: Math.random() > 0.3,
    insuranceCoverLakh: pick([25, 50, 100, 200, 500]),
    rating: 0,
    reviewCount: 0,
    phone: `+91${randomInt(7000000000, 9999999999)}`,
    bio: `${tradeTypes.join(' and ')} contractor based in ${area}, ${city}.`,
    logoUrl: `https://picsum.photos/seed/${slugify(name)}-logo/200/200`,
    projects,
  };
}

async function clean() {
  const deleted = await prisma.contractor.deleteMany({
    where: { licenseNumber: { startsWith: DEMO_LICENSE_PREFIX } },
  });
  console.log(`Removed ${deleted.count} demo contractor(s) (and their projects, via cascade).`);
}

async function seed() {
  // Auto-detects the highest existing DEMO/ license number and continues
  // right after it, so running this script again adds a NEW batch of 50
  // instead of regenerating (and overwriting) the same 50 — upsert is
  // keyed by licenseNumber, so reusing DEMO/0001-0050 would just replace
  // them with fresh random data rather than adding more.
  const existing = await prisma.contractor.findMany({
    where: { licenseNumber: { startsWith: DEMO_LICENSE_PREFIX } },
    select: { licenseNumber: true },
  });
  const highestExisting = existing.reduce((max, c) => {
    const n = parseInt(c.licenseNumber.replace(DEMO_LICENSE_PREFIX, ''), 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);

  const countArg = process.argv.find((a) => a.startsWith('--count='));
  const count = countArg ? parseInt(countArg.replace('--count=', ''), 10) : 50;

  const contractors = Array.from({ length: count }, (_, i) => generateContractor(highestExisting + i + 1));

  for (const c of contractors) {
    const slug = slugify(c.name) + '-' + c.licenseNumber.split('/')[1];

    const contractor = await prisma.contractor.upsert({
      where: { licenseNumber: c.licenseNumber },
      update: {
        name: c.name,
        slug,
        city: c.city,
        area: c.area,
        tradeTypes: c.tradeTypes,
        email: c.email,
        verificationStatus: c.verificationStatus,
        yearsInBusiness: c.yearsInBusiness,
        teamSizeMin: c.teamSizeMin,
        teamSizeMax: c.teamSizeMax,
        gstRegistered: c.gstRegistered,
        insuranceCoverLakh: c.insuranceCoverLakh,
        rating: c.rating,
        reviewCount: c.reviewCount,
        phone: c.phone,
        bio: c.bio,
        logoUrl: c.logoUrl,
      },
      create: {
        name: c.name,
        slug,
        city: c.city,
        area: c.area,
        tradeTypes: c.tradeTypes,
        licenseNumber: c.licenseNumber,
        email: c.email,
        verificationStatus: c.verificationStatus,
        yearsInBusiness: c.yearsInBusiness,
        teamSizeMin: c.teamSizeMin,
        teamSizeMax: c.teamSizeMax,
        gstRegistered: c.gstRegistered,
        insuranceCoverLakh: c.insuranceCoverLakh,
        rating: c.rating,
        reviewCount: c.reviewCount,
        phone: c.phone,
        bio: c.bio,
        logoUrl: c.logoUrl,
      },
    });

    await prisma.project.deleteMany({ where: { contractorId: contractor.id } });

    for (const p of c.projects) {
      await prisma.project.create({
        data: {
          contractorId: contractor.id,
          title: p.title,
          developerName: p.developerName,
          projectType: p.projectType,
          completedYear: p.completedYear,
          squareFeet: p.squareFeet,
          elevationFloors: p.elevationFloors,
          committedDurationMonths: p.committedDurationMonths,
          actualDurationMonths: p.actualDurationMonths,
          imageUrls: p.imageUrls,
        },
      });
    }

    console.log(`Upserted: ${contractor.name} (${c.projects.length} projects)`);
  }

  console.log(`\nDone. ${count} demo contractor(s) seeded.`);
  console.log(`Run "npx tsx prisma/seed-demo.ts --clean" to remove them all before launch.`);
}

const isClean = process.argv.includes('--clean');

(isClean ? clean() : seed())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
