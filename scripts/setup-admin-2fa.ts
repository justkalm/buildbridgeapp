// scripts/setup-admin-2fa.ts
//
// Run this ONCE to generate a new ADMIN_TOTP_SECRET and the otpauth:// URI
// to scan into an authenticator app (Google Authenticator, Authy,
// 1Password, etc.). This does NOT touch the database or .env for you —
// it just prints what to add. You control when the secret actually goes
// live by choosing when to paste it into .env and redeploy.
//
// Usage:
//   npx tsx scripts/setup-admin-2fa.ts
//
// After running: paste the printed secret into .env as ADMIN_TOTP_SECRET
// (and into Vercel's environment variables for production), then either
// scan the printed URI as a QR code or paste it into an app that accepts
// otpauth:// URIs directly. Every admin who needs to log in should scan
// the SAME code — see admin-totp.ts's header comment on why this is a
// shared secret, not a per-person one.

import { TOTP, Secret } from 'otpauth';

const secret = new Secret({ size: 20 });

const totp = new TOTP({
  issuer: '(kalm)',
  label: 'admin',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  secret,
});

console.log('\n=== (kalm) Admin 2FA Setup ===\n');
console.log('1. Add this to your .env (and Vercel env vars for production):\n');
console.log(`   ADMIN_TOTP_SECRET=${secret.base32}\n`);
console.log('2. Scan this URI as a QR code in your authenticator app, or paste it');
console.log('   into an app that accepts otpauth:// URIs directly:\n');
console.log(`   ${totp.toString()}\n`);
console.log('Every admin who needs to log in should scan the SAME code above —');
console.log('this is one shared secret, same as the shared admin password.\n');
