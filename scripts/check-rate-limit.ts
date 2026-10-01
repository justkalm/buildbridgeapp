// scripts/check-rate-limit.ts
//
// Proves the shared rate limiter works against the real Upstash Redis in
// .env (or reports that it fell back to the in-memory limiter). Uses a
// throwaway key with a limit of 3 per minute, hits it 5 times (expect 3
// allowed then 2 blocked), tests a refund, then deletes the key. Touches
// nothing else. Never prints the Redis URL or token.
//
//   npx tsx scripts/check-rate-limit.ts

import 'dotenv/config';
import {
  checkRateLimit,
  refundRateLimit,
  deleteRateLimitKey,
  lastRateLimitBackend,
} from '../src/lib/rate-limit';

async function main() {
  const key = `check-script:${Date.now()}`;
  const opts = { maxAttempts: 3, windowMs: 60_000 };

  for (let i = 1; i <= 5; i++) {
    const ok = await checkRateLimit(key, opts);
    console.log(`attempt ${i}: ${ok ? 'allowed' : 'BLOCKED'} (backend: ${lastRateLimitBackend()})`);
  }

  await refundRateLimit(key);
  const afterRefund = await checkRateLimit(key, opts);
  console.log(`after one refund: ${afterRefund ? 'allowed' : 'BLOCKED'} (expect allowed)`);
  const again = await checkRateLimit(key, opts);
  console.log(`next attempt: ${again ? 'allowed' : 'BLOCKED'} (expect BLOCKED)`);

  await deleteRateLimitKey(key);
  const fresh = await checkRateLimit(key, opts);
  console.log(`after delete: ${fresh ? 'allowed' : 'BLOCKED'} (expect allowed)`);
  await deleteRateLimitKey(key);

  console.log(
    lastRateLimitBackend() === 'redis'
      ? 'Result: Redis is working.'
      : 'Result: FELL BACK to in-memory (Redis not configured or unreachable).'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
