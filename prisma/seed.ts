// prisma/seed.ts
//
// Run with: npx prisma db seed
//
// This is the "add a contractor by hand" tool for right now — edit the
// `contractors` array below and re-run. It's intentionally simple: no UI,
// no auth, just a script you run from your terminal when you've onboarded
// someone new.
//
// This becomes unnecessary once the admin UI (Step 2 of this build) exists,
// but it's the fastest way to get your first real contractors into the
// database today, and every field here maps directly to the admin form
// we'll build next — so filling this in now isn't wasted work.

import { PrismaClient, VerificationStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Slugify a contractor name into a URL-safe slug — e.g.
// "Kunal Raut Constructions" -> "kunal-raut-constructions"
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

type SeedContractor = {
  name: string;
  city: string;
  area: string;
  tradeTypes: string[];
  licenseNumber: string;
  verificationStatus: VerificationStatus;
  yearsInBusiness?: number;
  teamSizeMin?: number;
  teamSizeMax?: number;
  gstRegistered?: boolean;
  insuranceCoverLakh?: number;
  rating?: number;
  reviewCount?: number;
  phone: string;
  email?: string;
  bio?: string;
  projects?: {
    title: string;
    developerName?: string;
    projectType?: string;
    completedYear?: number;
    squareFeet?: number;
    elevationFloors?: number;
    committedDurationMonths?: number;
    actualDurationMonths?: number;
  }[];
};

// --- Edit this array to add real contractors -------------------------------
//
// IMPORTANT: only set verificationStatus to VERIFIED once you've actually
// checked the license number against the real state contractor registry.
// Leave it as PENDING otherwise — the badge only means something if this
// stays honest.

const contractors: SeedContractor[] = [
  {
    name: 'Kunal Raut Constructions',
    city: 'Mumbai',
    area: 'Thane',
    tradeTypes: ['RCC & Structural', 'Waterproofing'],
    licenseNumber: 'MH/RCC/08812',
    verificationStatus: 'VERIFIED', // change to VERIFIED once you've checked this
    yearsInBusiness: 15,
    teamSizeMin: 80,
    teamSizeMax: 120,
    gstRegistered: true,
    insuranceCoverLakh: 200,
    rating: 0, // no real reviews yet — don't set a rating until you have real ones
    reviewCount: 0,
    phone: '+919820245024', // replace with the real number before running
    bio: 'RCC and structural contractor based in Thane.',
    projects: [
      // Add real completed projects here once you have them from the
      // contractor. Leave empty if you don't have verified details yet —
      // an empty project list is honest; an invented one isn't.
    ],
  },
];

async function main() {
  for (const c of contractors) {
    const slug = slugify(c.name);

    const contractor = await prisma.contractor.upsert({
      where: { licenseNumber: c.licenseNumber },
      update: {
        name: c.name,
        slug,
        city: c.city,
        area: c.area,
        tradeTypes: c.tradeTypes,
        verificationStatus: c.verificationStatus,
        yearsInBusiness: c.yearsInBusiness,
        teamSizeMin: c.teamSizeMin,
        teamSizeMax: c.teamSizeMax,
        gstRegistered: c.gstRegistered ?? false,
        insuranceCoverLakh: c.insuranceCoverLakh,
        rating: c.rating ?? 0,
        reviewCount: c.reviewCount ?? 0,
        phone: c.phone,
        email: c.email ?? `seed.${c.licenseNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@placeholder.buildbridge.dev`,
        bio: c.bio,
      },
      create: {
        name: c.name,
        slug,
        city: c.city,
        area: c.area,
        tradeTypes: c.tradeTypes,
        licenseNumber: c.licenseNumber,
        verificationStatus: c.verificationStatus,
        yearsInBusiness: c.yearsInBusiness,
        teamSizeMin: c.teamSizeMin,
        teamSizeMax: c.teamSizeMax,
        gstRegistered: c.gstRegistered ?? false,
        insuranceCoverLakh: c.insuranceCoverLakh,
        rating: c.rating ?? 0,
        reviewCount: c.reviewCount ?? 0,
        phone: c.phone,
        email: c.email ?? `seed.${c.licenseNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@placeholder.buildbridge.dev`,
        bio: c.bio,
      },
    });

    console.log(`Upserted contractor: ${contractor.name} (${contractor.id})`);

    if (c.projects && c.projects.length > 0) {
      // Clear existing projects for this contractor before re-adding, so
      // re-running the seed doesn't duplicate projects on every run.
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
          },
        });
      }
      console.log(`  Added ${c.projects.length} project(s)`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
