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

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
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
