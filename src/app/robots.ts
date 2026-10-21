// src/app/robots.ts
//
// /robots.txt: points crawlers at the sitemap and fences off the signed-in
// areas. (/admin is deliberately not listed: naming it only advertises the
// login; it has its own noindex in src/app/admin/layout.tsx.)
//
// The private pages a crawler CAN reach (sign-in, password links, /join,
// the report form) are kept out of results by their own "noindex" tag
// (NEVER_INDEX in src/lib/site.ts) rather than listed here, because a
// crawler that's blocked never reads that tag and can still list a bare
// link it found elsewhere. /contractor/signup is open on purpose: it's how
// contractors find us.
//
// Whether PUBLIC pages appear in search is the SEARCH_ENGINES_ALLOWED
// switch in src/lib/site.ts, not this file.
//
// /api/contractors (the list) and /api/contractors/<slug> (one profile) are
// let through: /browse and the profile pages fetch their cards from them in
// the browser, so a crawler blocked from them sees only "Loading…" and
// reports a soft 404 (Search Console, 21 Oct). They return public card data
// only (no phone). The account endpoints under that path stay blocked;
// Google follows the longest matching rule. The JSON itself carries an
// X-Robots-Tag noindex (next.config.ts) so it never shows up as a result.

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/contractors'],
      disallow: [
        '/api/',
        '/api/contractors/me',
        '/api/contractors/signup',
        '/api/contractors/upload',
        '/api/contractors/forgot-password',
        '/api/contractors/reset-password',
        '/api/contractors/verify-email',
        '/dashboard',
        '/messages',
        '/contractor/dashboard',
        '/contractor/profile',
        '/contractor/projects',
        '/contractor/consent',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
