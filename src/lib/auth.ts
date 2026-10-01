// src/lib/auth.ts
//
// NextAuth v5 config. Credentials-based (email + password) for both
// Developer and Contractor accounts, distinguished by a `role` field
// carried in the JWT/session. A single Credentials provider tries
// Developer first, then Contractor, rather than two separate providers —
// simpler for the login form (one email/password pair, no "I am a
// developer/contractor" toggle needed at login time, since email is unique
// per table but the same address could theoretically exist in both; in
// practice each person is one or the other).
//
// The admin page itself still uses a separate, simpler shared-password
// gate — see src/lib/admin-auth.ts. Not folding admin into this system;
// admin is a single shared account, not a per-person one.
//
// LOGIN RATE LIMITING (in authorize() below). Two independent buckets,
// both must have room or the attempt is refused before any DB lookup or
// bcrypt work happens:
//
//   - Per normalized email: 10 failed attempts / 15 minutes. This is the
//     one that stops password-guessing against a single account. 10 is
//     comfortably more than a real person fumbling between two or three
//     passwords they might have used, and at 40 guesses/hour it makes
//     online guessing useless against anything that passes the password
//     policy (src/lib/password-policy.ts). Trade-off, stated honestly:
//     anyone who knows your email can deliberately trip this and lock you
//     out for up to 15 minutes. That's why the window is short, why it
//     never locks permanently, and why the blocked message on the login
//     page points to "Forgot password?" — the reset flow isn't gated by
//     this limit.
//   - Per client IP: 30 failed attempts / 15 minutes. This is the one that
//     stops one machine spraying a common password across MANY emails
//     (which the per-email limit alone can't see). Set 3x the email limit
//     rather than tighter because many Indian mobile users sit behind
//     carrier-grade NAT (Jio/Airtel share one public IP across lots of
//     subscribers), as do office networks — a tight IP limit would punish
//     strangers for each other's typos.
//
// Counting FAILED attempts only, not all attempts. A successful login
// gives its reserved attempt back (refundRateLimit), so someone who logs
// in and out a lot, or an office where 40 people sign in each morning
// from one IP, never hits the limit. Implementation detail that matters:
// the attempt is RESERVED synchronously before bcrypt runs and refunded
// afterwards on success — not "check, then record the failure later".
// The latter lets an attacker fire 100 parallel requests that all pass
// the check during the ~250ms bcrypt takes, before any failure is
// recorded. Reserve-then-refund can't be raced that way. A success only
// refunds its OWN reservation, never earlier failures — so an attacker
// can't "wash" a bucket by interleaving logins to their own account.
//
// Same shared limiter as admin login (src/lib/rate-limit.ts): the counts
// live in Upstash Redis, so the limits hold across every server instance
// and survive deploys. If Redis is unreachable or not configured, it falls
// back to a per-instance in-memory counter (and logs once), so a Redis
// outage degrades the limit rather than breaking login. The password
// policy is still what actually makes guessing hopeless.
//
// When blocked, authorize() throws LoginRateLimited (a CredentialsSignin
// subclass with code 'rate_limited'). NextAuth passes that code through to
// the client's signIn() result, which is how the login page can say
// "too many attempts" instead of the generic "incorrect email or
// password". The code is checked BEFORE the account lookup, so it leaks
// nothing about whether an email is registered.

import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, refundRateLimit, getClientIp } from '@/lib/rate-limit';
import { LOGIN_RATE_LIMITED_CODE } from '@/lib/auth-codes';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES_PER_EMAIL = 10;
const LOGIN_MAX_FAILURES_PER_IP = 30;

class LoginRateLimited extends CredentialsSignin {
  code = LOGIN_RATE_LIMITED_CODE;
}

// The pre-rate-limiting authorize() body, unchanged apart from being
// pulled out so authorize() can wrap it with the reserve/refund logic.
// Returns the user on success, null on any failure (unknown email, wrong
// password, unclaimed contractor) — deliberately indistinguishable.
async function verifyCredentials(normalizedEmail: string, password: string) {
  const developer = await prisma.developer.findUnique({
    where: { email: normalizedEmail },
  });

  if (developer) {
    const passwordValid = await bcrypt.compare(password, developer.passwordHash);
    if (!passwordValid) return null;

    return {
      id: developer.id,
      name: developer.name,
      email: developer.email,
      role: 'developer' as const,
      sessionVersion: developer.sessionVersion,
    };
  }

  // Not a developer — try contractor. A contractor with no
  // passwordHash yet (admin-entered placeholder that hasn't signed
  // up) can never authenticate here, by design.
  const contractor = await prisma.contractor.findUnique({
    where: { email: normalizedEmail },
  });

  if (contractor?.passwordHash) {
    const passwordValid = await bcrypt.compare(password, contractor.passwordHash);
    if (!passwordValid) return null;

    return {
      id: contractor.id,
      name: contractor.name,
      email: contractor.email,
      role: 'contractor' as const,
      sessionVersion: contractor.sessionVersion,
    };
  }

  return null;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Developers and contractors stay signed in like in a phone app, so
  // notifications and the Home Screen app keep working. A login lasts 30
  // days from the last visit (refreshed at most once a day while used);
  // after 30 days without opening (kalm) they're signed out. These are
  // NextAuth's defaults, written out so the rule is visible. Admin has its
  // own, much shorter 4-hour session (src/lib/admin-auth.ts).
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const normalizedEmail = email.toLowerCase().trim();

        // Reserve one attempt in each bucket up front — see the file
        // header for why this is reserve-then-refund rather than
        // record-on-failure. IP first: if the IP is already over, don't
        // also charge the (possibly innocent) email's bucket.
        //
        // If no client IP could be determined, skip the IP bucket rather
        // than fall back to getClientIp's shared 'unknown' key: on the
        // login path that would turn into ONE bucket for every visitor,
        // and 30 strangers' typos would lock the whole site out. The
        // per-email bucket still applies. (On Vercel x-forwarded-for is
        // always set, so this only really affects local dev.)
        const ip = getClientIp(request);
        const ipKey = ip === 'unknown' ? null : `login-ip:${ip}`;
        const emailKey = `login-email:${normalizedEmail}`;
        const opts = { windowMs: LOGIN_WINDOW_MS };
        if (ipKey && !(await checkRateLimit(ipKey, { ...opts, maxAttempts: LOGIN_MAX_FAILURES_PER_IP }))) {
          throw new LoginRateLimited();
        }
        if (!(await checkRateLimit(emailKey, { ...opts, maxAttempts: LOGIN_MAX_FAILURES_PER_EMAIL }))) {
          // The IP reservation above stays charged: a request aimed at a
          // locked-out account is itself a signal worth counting.
          throw new LoginRateLimited();
        }

        const user = await verifyCredentials(normalizedEmail, password);

        if (user) {
          // Success — give both reservations back so only failures count.
          await refundRateLimit(emailKey);
          if (ipKey) await refundRateLimit(ipKey);
        }
        return user;
      },
    }),
  ],
  callbacks: {
    // PASSWORD RESET SIGNS OUT OTHER DEVICES (task sheet F5, KALM-186).
    // Each account has a sessionVersion number, bumped by every password
    // reset. A login remembers the number it saw (token.sv). On every
    // later session check we compare it with the account's current number;
    // if the password has been reset since, the numbers differ and
    // returning null makes NextAuth delete that device's login cookie, so
    // it's signed out. One small database read per check, by primary key.
    // Logins from before this existed carry no number and count as 0,
    // which matches the default, so deploying this signs nobody out.
    // A deleted account also fails the check and is signed out.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.sv = (user as { sessionVersion?: number }).sessionVersion ?? 0;
        return token;
      }

      if (typeof token.id !== 'string') return null;
      const where = { id: token.id };
      const select = { sessionVersion: true } as const;
      const account =
        token.role === 'developer'
          ? await prisma.developer.findUnique({ where, select })
          : token.role === 'contractor'
            ? await prisma.contractor.findUnique({ where, select })
            : null;
      if (!account || account.sessionVersion !== ((token.sv as number | undefined) ?? 0)) {
        return null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string | undefined;
      }
      return session;
    },
  },
});
