// src/lib/admin-totp.ts
//
// Verifies a 6-digit TOTP code against ADMIN_TOTP_SECRET — the second
// factor on top of the shared admin password. Uses the `otpauth` package
// (RFC 6238 compliant, what Google Authenticator/Authy/1Password etc. all
// implement), rather than hand-rolling HMAC-based OTP math.
//
// Same tradeoff as ADMIN_PASSWORD: one shared secret, not per-person. Every
// admin scans the same QR code into their own authenticator app — anyone
// who has it can generate valid codes, same as anyone who knows the
// password can log in. This still meaningfully raises the bar: a leaked
// password ALONE is no longer enough, since it's also missing a
// time-limited code that isn't stored anywhere static (unlike a password,
// which — once known — stays valid until rotated). Move to per-admin TOTP
// secrets once real per-user admin accounts exist (see admin-auth.ts's
// header comment on that same future step).

import { TOTP, Secret } from 'otpauth';

function getTotp(): TOTP | null {
  const secret = process.env.ADMIN_TOTP_SECRET;
  if (!secret) return null;

  return new TOTP({
    issuer: '(kalm)',
    label: 'admin',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });
}

export function verifyAdminTotp(code: string): boolean {
  const totp = getTotp();
  if (!totp) {
    console.error('ADMIN_TOTP_SECRET is not set — cannot verify 2FA code');
    return false;
  }

  // window: 1 allows the code from one 30s step before/after the current
  // one to also validate — accounts for small clock drift between the
  // server and whoever's phone generated the code, without opening a wide
  // replay window. validate() returns the matched step offset (a number,
  // including 0) on success, or null on failure — null is the only
  // falsy-but-not-zero case here, so checking `!== null` (not truthiness)
  // matters.
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}
