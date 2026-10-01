// src/lib/rate-limit.ts
//
// Shared rate limiter. Keys are caller-chosen strings (an IP, a user id, a
// normalized email), prefixed per endpoint so buckets don't collide. Used
// by admin login, user login (src/lib/auth.ts, keyed by BOTH email and
// IP), signup, forgot-password, and the logged-in write endpoints.
//
// WHERE THE COUNTS LIVE. Normally in Upstash Redis (REST API, so it works
// from Vercel's serverless functions with no connection pooling). Every
// server instance talks to the same Redis, so the limit is a real limit
// across all concurrent invocations and survives redeploys. Before this,
// the counts lived in each instance's own memory, which meant an attacker
// spread across many warm instances got "limit x number of instances".
//
// FIXED WINDOW. The first hit on a key creates it with a TTL of windowMs;
// later hits increment it until the TTL expires and the key vanishes. Same
// behaviour as the old in-memory version: the window starts at the first
// attempt and does not slide.
//
// ATOMIC, VIA LUA. Each check is ONE Redis script (INCR, set the TTL if
// it is missing, compare with the max). Doing it as separate commands could
// leave a counter with no expiry if the process died between INCR and
// PEXPIRE, which would lock that key out forever. The script also repairs
// that state: if it ever sees a counter with no TTL it sets one.
//
// RESERVE-THEN-REFUND, and the reject case. checkRateLimit() reserves an
// attempt up front by incrementing. If the new count would exceed
// maxAttempts, the script immediately decrements it again and reports
// "blocked". So a rejected call leaves the counter exactly where it was
// (at maxAttempts), never inflated. That matters for refundRateLimit(): the
// login flow only refunds after a call that was ALLOWED, and a counter that
// crept above the max from rejected calls would make later refunds
// undercount and keep people locked out longer than the window says.
// refundRateLimit() decrements only if the key still exists and is above
// zero, so refunding after the window expired (key gone) is a no-op and the
// counter can never go negative.
//
// NEVER TAKES THE SITE DOWN. If the two env vars are missing, or Redis
// throws or takes longer than REDIS_TIMEOUT_MS, we fall back to the
// in-memory limiter below (same semantics, per-instance only) and log one
// console.error per process so the problem is visible without flooding
// logs. A degraded limiter is better than a login page that returns 500.
// Note a fallback can mean a check hit Redis and its refund hits memory (or
// the reverse); the refund is then a harmless no-op or a harmless extra
// give-back, and everything expires with its window.
//
// This is NOT a substitute for password strength; it blunts scripted
// guessing and caps wasted compute.
//
// getClientIp() at the bottom documents which IP header we trust and why.

import { Redis } from '@upstash/redis';

// ---------------------------------------------------------------------
// Redis backend
// ---------------------------------------------------------------------

const KEY_PREFIX = 'rl:';
const REDIS_TIMEOUT_MS = 1500;

// KEYS[1] = counter key, ARGV[1] = max attempts, ARGV[2] = window ms.
// Returns 1 if allowed, 0 if blocked.
const CHECK_SCRIPT = `
local c = redis.call('INCR', KEYS[1])
if c == 1 or redis.call('PTTL', KEYS[1]) < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
if c > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])
  return 0
end
return 1
`;

// Give one attempt back, only if the key still exists and is above zero.
const REFUND_SCRIPT = `
local c = tonumber(redis.call('GET', KEYS[1]))
if c and c > 0 then
  redis.call('DECR', KEYS[1])
end
return 1
`;

let redisClient: Redis | null | undefined; // undefined = not yet created
let warned = false;
let lastBackend: 'redis' | 'memory' | null = null;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisClient = null;
    warnOnce('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set');
  } else {
    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

function warnOnce(reason: string) {
  if (warned) return;
  warned = true;
  console.error(
    `[rate-limit] Redis unavailable (${reason}). Falling back to the per-instance in-memory limiter; limits are weaker until this is fixed.`
  );
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out after ${REDIS_TIMEOUT_MS}ms`)),
      REDIS_TIMEOUT_MS
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

// ---------------------------------------------------------------------
// In-memory fallback (per server instance)
// ---------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodic cleanup so `buckets` doesn't grow unbounded across a long-lived
// process; without this, every distinct IP that ever hits the endpoint
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

function checkMemory(
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

function refundMemory(key: string): void {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt < Date.now()) return;
  if (existing.count > 0) existing.count -= 1;
}

// ---------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------

/**
 * Resolves true if the request should be ALLOWED, false if it should be
 * rejected for exceeding the limit. Reserves one attempt when allowed.
 */
export async function checkRateLimit(
  key: string,
  opts: { maxAttempts: number; windowMs: number }
): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    try {
      const result = await withTimeout(
        redis.eval<[string, string], number>(
          CHECK_SCRIPT,
          [KEY_PREFIX + key],
          [String(opts.maxAttempts), String(opts.windowMs)]
        )
      );
      lastBackend = 'redis';
      return Number(result) === 1;
    } catch (err) {
      warnOnce(err instanceof Error ? err.message : 'unknown error');
    }
  }
  lastBackend = 'memory';
  return checkMemory(key, opts);
}

/**
 * Gives back one attempt previously consumed by a SUCCESSFUL
 * checkRateLimit() call on the same key. Used by the login flow to make
 * the limit effectively count only failed attempts while still reserving
 * the attempt up front; see authorize() in src/lib/auth.ts for why that
 * ordering matters (parallel requests can't all slip past a "check now,
 * record the failure later" limiter while bcrypt is running).
 *
 * Only call this after checkRateLimit() resolved true for this key. A
 * no-op if the counter already expired. Never throws.
 */
export async function refundRateLimit(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await withTimeout(redis.eval(REFUND_SCRIPT, [KEY_PREFIX + key], []));
      return;
    } catch (err) {
      warnOnce(err instanceof Error ? err.message : 'unknown error');
    }
  }
  refundMemory(key);
}

/**
 * For scripts/check-rate-limit.ts only: which backend served the most
 * recent checkRateLimit() call, and a way to delete a test key.
 */
export function lastRateLimitBackend(): 'redis' | 'memory' | null {
  return lastBackend;
}

export async function deleteRateLimitKey(key: string): Promise<void> {
  buckets.delete(key);
  const redis = getRedis();
  if (redis) {
    try {
      await withTimeout(redis.del(KEY_PREFIX + key));
    } catch {
      // best effort
    }
  }
}

/**
 * Best-effort client IP extraction, with the trust decision spelled out.
 *
 * An IP header is only trustworthy if the platform in front of us
 * overwrites it. On Vercel the edge sets x-vercel-forwarded-for (and
 * x-real-ip) itself and replaces any client-supplied x-forwarded-for, so
 * a visitor can't pick their own rate-limit bucket by sending a fake
 * header. Order of preference: x-vercel-forwarded-for, x-real-ip, then the
 * FIRST x-forwarded-for entry (the original client as Vercel saw it).
 *
 * IF THIS APP IS EVER PUT BEHIND ANOTHER PROXY OR CDN (Cloudflare in
 * front of Vercel, a self-hosted nginx, etc.) THIS MUST BE REVISITED: that
 * layer's headers, or a client-forged x-forwarded-for it passes through,
 * would otherwise be read here and the per-IP limits could be dodged by
 * rotating a fake header.
 *
 * Returns 'unknown' when nothing is present (local dev). Callers on the
 * login path skip the IP bucket in that case instead of sharing one key.
 */
export function getClientIp(req: Request): string {
  const vercel = req.headers.get('x-vercel-forwarded-for');
  if (vercel) return vercel.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return 'unknown';
}
