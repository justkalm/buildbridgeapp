// scripts/check-email-delivery.ts
//
// Diagnostic for "the reset email never arrived". For one address it:
//   1. says whether a developer and/or contractor account uses it (and
//      whether a contractor account has actually been claimed, since a
//      password reset only matters for an account that can log in);
//   2. sends ONE plain test email to that address through the same Resend
//      setup the app uses, and prints Resend's exact answer, so a refusal
//      (e.g. the test sender only delivering to the Resend account owner)
//      is visible instead of silent.
// It changes nothing in the database and creates no reset link.
//
//   npx tsx scripts/check-email-delivery.ts someone@example.com

import 'dotenv/config';
import { Resend } from 'resend';
import { prisma } from '../src/lib/prisma';

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  if (!email || !email.includes('@')) {
    console.log('Usage: npx tsx scripts/check-email-delivery.ts someone@example.com');
    process.exit(1);
  }

  const [developer, contractor] = await Promise.all([
    prisma.developer.findUnique({ where: { email }, select: { name: true } }),
    prisma.contractor.findUnique({ where: { email }, select: { name: true, passwordHash: true } }),
  ]);

  console.log(`\nAccounts using ${email}:`);
  console.log(`  Developer:  ${developer ? `yes (${developer.name})` : 'no'}`);
  console.log(
    `  Contractor: ${
      contractor ? `yes (${contractor.name})${contractor.passwordHash ? '' : ', but NOT claimed yet (no password set)'}` : 'no'
    }`
  );
  if (!developer && !contractor) {
    console.log('  → No account uses this address, so the reset form (correctly) sends nothing.');
  }

  if (!process.env.RESEND_API_KEY) {
    console.log('\nRESEND_API_KEY is not set in .env, so no email can be sent at all.');
    return;
  }

  console.log('\nSending one test email through Resend...');
  const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: '(kalm) <onboarding@resend.dev>',
    to: email,
    subject: '(kalm) email delivery test',
    html: '<p>This is a test from (kalm) to check that emails reach this address. You can ignore it.</p>',
  });
  if (error) {
    console.log('  ✗ Resend REFUSED it:');
    console.log(`    ${error.name ?? ''}: ${error.message}`);
  } else {
    console.log(`  ✓ Resend accepted it (id ${data?.id}). Check the inbox and the spam folder.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
