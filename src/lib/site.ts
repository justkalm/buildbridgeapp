// src/lib/site.ts
//
// Site-wide settings for search engines and link previews.
//
// SEARCH_ENGINES_ALLOWED is OFF until launch (owner, 3 Oct 2026). While
// it's off, every page tells search engines "don't list this" (a robots
// meta tag plus an X-Robots-Tag header, see next.config.ts); robots.txt only
// fences off private areas. Reasons: the site still lives on a temporary address
// (kalm-gold.vercel.app; Google would learn the wrong one) and most
// contractors are demo placeholders that shouldn't appear in search
// results under the (kalm) name. Link previews in WhatsApp and similar
// apps are NOT affected: those read the page's preview tags regardless.
//
// Launch day: buy and connect the real domain, replace the demo
// contractors, then set this to true and redeploy (task sheet G).
// 17 Oct 2026: the domain is done (app.justkalm.in, and the old address
// now redirects there, see proxy.ts), the sitemap and per-page noindex for
// private pages are in. Still waiting on: the only public contractors are
// five that look like test accounts, which would go into Google under the
// (kalm) name. Turn this on once they are hidden or confirmed real.
export const SEARCH_ENGINES_ALLOWED = false;

// For pages that must never be in search results, whatever the switch
// above says: sign-in, password and email links, dashboards, messages,
// the report form and /join (17 Oct 2026). Public pages (home, browse,
// contractor profiles, about, contact, sign-up, post a project, terms,
// privacy) follow the switch. Admin has its own copy in admin/layout.tsx.
export const NEVER_INDEX = { index: false, follow: false } as const;

// The address used to build full links in previews. NEXTAUTH_URL is set
// per environment (the live site's address on Vercel, localhost on the
// laptop), so previews always point at the site they came from.
export const SITE_URL = process.env.NEXTAUTH_URL || 'https://kalm-gold.vercel.app';

export const SITE_NAME = '(kalm)';

export const SITE_DESCRIPTION =
  'Find verified contractors for your project. See their completed work with photos, timelines and sizes, then request a quote or schedule a site visit.';

// Where a Pending contractor sends their licence, GST and registration
// papers (shown on the contractor dashboard, src/components/OnboardingPanel.tsx).
// Email is the work inbox (owner, 4 Oct 2026). WhatsApp stays EMPTY until the
// company number exists; fill it in and the dashboard offers it automatically.
// With both empty the dashboard says nothing about where to send papers.
// WhatsApp: digits with country code, no plus or spaces, e.g. '919800000000'.
export const VERIFICATION_WHATSAPP = '';
export const VERIFICATION_EMAIL = 'connect@justkalm.in';
