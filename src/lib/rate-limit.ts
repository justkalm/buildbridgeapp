// src/lib/rate-limit.ts
//
// A simple in-memory rate limiter for endpoints that don't warrant pulling
// in Redis/Upstash. Keys are caller-chosen strings (an IP, a user id, a
// normalized email), prefixed per endpoint so buckets don't collide. Used
// by admin login, user login (src/lib/auth.ts — keyed by BOTH email and
// IP), signup, forgot-password, and the logged-in write endpoints.
//
// KNOWN LIMITATION, stated plainly: this only works within a single
// running server process. On Vercel, each serverless function instance
// has its own memory, so a determined attacker distributing requests
// across many concurrent invocations (or simply hitting a cold-start
// retry) can get more attempts than this limit implies. It also resets on
// every redeploy. This is NOT a substitute for the password strength
// itself doing the real work — it exists to blunt casual/scripted
// hammering and cap wasted compute, not to make brute-force
// cryptographically infeasible (the 25-character admin password already
// does that on its own). If this ever needs to be airtight — e.g. once
// there's a real per-user admin system — replace this with Upstash Redis
// or Vercel's own rate-limiting/WAF features instead of scaling this up.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodic cleanup so `buckets` doesn't grow unbounded across a long-lived
// process — without this, every distinct IP that ever hits the endpoint
// leaves a permanent entry.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();
function cleanupIfDue() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

/**
 * Returns true if the request should be ALLOWED, false if it should be
 * rejected for exceeding the limit.
 */
export function checkRateLimit(
  key: string,
  { maxAttempts, windowMs }: { maxAttempts: number; windowMs: number }
): boolean {
  cleanupIfDue();

  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= maxAttempts) {
    return false;
  }

  existing.count += 1;
  return true;
}

/**
 * Gives back one attempt previously consumed by a SUCCESSFUL
 * checkRateLimit() call on the same key. Used by the login flow to make
 * the limit effectively count only failed attempts while still reserving
 * the attempt synchronously up front — see authorize() in src/lib/auth.ts
 * for why that ordering matters (parallel requests can't all slip past a
 * "check now, record the failure later" limiter while bcrypt is running).
 *
 * Only call this after checkRateLimit() returned true for this key;
 * a rejected call never incremented anything, so refunding it would hand
 * out a free attempt. No-op if the bucket already expired or was cleaned
 * up in between.
 */
export function refundRateLimit(key: string): void {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt < Date.now()) return;
  if (existing.count > 0) existing.count -= 1;
}

// Best-effort client IP extraction. Vercel sets x-forwarded-for; falls
// back to a constant key if unavailable (e.g. local dev), which means
// local dev shares one global bucket — fine, since this only matters in
// production.
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}
