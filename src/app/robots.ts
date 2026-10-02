// src/app/robots.ts
//
// /robots.txt. Only fences off private areas. It deliberately does NOT
// block the whole site before launch: a crawler that's blocked never reads
// the "noindex" tag on the page (see SEARCH_ENGINES_ALLOWED in
// src/lib/site.ts), so Google could still list bare links it found
// elsewhere, and some link-preview apps also obey robots.txt. The noindex
// tag and header are what keep the site out of search results.

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/dashboard', '/contractor/', '/messages'] },
  };
}
