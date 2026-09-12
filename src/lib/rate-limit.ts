// src/lib/rate-limit.ts
//
// A simple in-memory rate limiter, keyed by IP, for endpoints that don't
// warrant pulling in Redis/Upstash — currently just admin login.
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

// Best-effort client IP extraction. Vercel sets x-forwarded-for; falls
// back to a constant key if unavailable (e.g. local dev), which means
// local dev shares one global bucket — fine, since this only matters in
// production.
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}
