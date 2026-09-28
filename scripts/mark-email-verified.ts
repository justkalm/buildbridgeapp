// scripts/mark-email-verified.ts
//
// Admin tool: marks ONE developer's email as verified by hand, for when
// the verification email can't reach them. Until a real domain is verified
// in Resend, the site can only send email to the Resend account owner's
// own address, so any other developer (including test accounts) can never
// click a verification link, and is blocked from sending quote requests,
// posting projects and scheduling site visits.
//
// Only use this for an address you know is real and belongs to the person
// (e.g. your own test account, or a developer you've spoken to). Verifying
// an address this way skips the proof that they own the inbox.
//
//   npx tsx scripts/mark-email-verified.ts someone@example.com
//
// Developers only. Contractors aren't blocked on email verification.

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  if (!email || !email.includes('@')) {
    console.log('Usage: npx tsx scripts/mark-email-verified.ts someone@example.com');
    process.exit(1);
  }

  const developer = await prisma.developer.findUnique({
    where: { email },
    select: { id: true, name: true, emailVerified: true },
  });
  if (!developer) {
    console.log(`No developer account found with the email ${email}.`);
    process.exit(1);
  }
  if (developer.emailVerified) {
    console.log(`${developer.name} (${email}) is already verified. Nothing to do.`);
    return;
  }

  await prisma.developer.update({
    where: { id: developer.id },
    data: { emailVerified: true, emailVerifyToken: null, emailVerifyTokenExpiresAt: null },
  });
  console.log(`Done: ${developer.name} (${email}) is now verified.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
