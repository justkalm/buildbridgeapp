// src/lib/same-origin.ts
//
// Origin check for state-changing admin requests (a second CSRF defense on
// top of the SameSite cookie flag). SameSite already stops browsers sending
// the admin cookie on most cross-site requests, but it has gaps (older
// browsers, "same-site but cross-origin" sibling subdomains, and any future
// change to the cookie settings), so admin mutations also insist that the
// request itself says it came from this site.
//
// How it decides. Browsers always attach an Origin header to cross-site
// POST/PUT/PATCH/DELETE, and to same-origin fetch() calls that aren't GET,
// which is all our admin UI does. So:
//   1. Use the Origin header. If absent, fall back to the origin of the
//      Referer header.
//   2. If both are absent, REJECT. A real browser request from our admin
//      pages always has one of them; a request with neither is a script or
//      an odd client, and admin mutations don't need to support those.
//   3. Compare with this request's own origin, built from x-forwarded-host
//      / host and x-forwarded-proto (what the browser actually typed on
//      Vercel), plus new URL(req.url).origin as another candidate.
//   4. In development only, also allow http://localhost:3000 style origins
//      and the LAN address in allowedDevOrigins (next.config.ts) so phone
//      testing on the same Wi-Fi keeps working.
//
// Call rejectCrossOrigin(req) first thing in every non-GET handler under
// src/app/api/admin/.

import { NextResponse } from 'next/server';

// Keep in step with allowedDevOrigins in next.config.ts.
const DEV_LAN_HOSTS = ['192.168.0.157'];

function originOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function firstValue(v: string | null): string | null {
  if (!v) return null;
  return v.split(',')[0].trim() || null;
}

export function isSameOrigin(req: Request): boolean {
  const claimed = originOf(req.headers.get('origin')) ?? originOf(req.headers.get('referer'));
  if (!claimed) return false;

  const allowed = new Set<string>();

  const host = firstValue(req.headers.get('x-forwarded-host')) ?? firstValue(req.headers.get('host'));
  if (host) {
    const proto = firstValue(req.headers.get('x-forwarded-proto'));
    if (proto) {
      allowed.add(`${proto}://${host}`);
    } else {
      allowed.add(`https://${host}`);
      allowed.add(`http://${host}`);
    }
  }
  try {
    allowed.add(new URL(req.url).origin);
  } catch {
    // ignore a malformed req.url
  }

  if (process.env.NODE_ENV === 'development') {
    allowed.add('http://localhost:3000');
    allowed.add('http://127.0.0.1:3000');
    for (const h of DEV_LAN_HOSTS) allowed.add(`http://${h}:3000`);
  }

  return allowed.has(claimed);
}

export function rejectCrossOrigin(req: Request): NextResponse | null {
  if (isSameOrigin(req)) return null;
  return NextResponse.json(
    { error: 'Request blocked: it did not come from the (kalm) site.' },
    { status: 403 }
  );
}
