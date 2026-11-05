// src/lib/structured-data.ts
//
// What we tell search engines about (kalm) and its contractors, in
// schema.org terms (rendered by src/components/JsonLd.tsx). Google uses it
// to understand a page and to tie the site to the Google Business Profile.
//
// Deliberately left out:
//   - Contractor phone numbers: not public (see the profile API).
//   - Ratings (aggregateRating): reviews are entered by our admin, and
//     Google's rules don't allow review markup a business controls itself.

import { GOOGLE_BUSINESS_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL, VERIFICATION_EMAIL } from '@/lib/site';
import { tradesOf } from '@/lib/trade-types';

const ORG_ID = `${SITE_URL}/#organization`;

// The company behind the site. sameAs links the Google Business Profile once
// GOOGLE_BUSINESS_URL is filled in (src/lib/site.ts).
export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    legalName: 'Kalm Enterprises Private Limited',
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    email: VERIFICATION_EMAIL,
    description: SITE_DESCRIPTION,
    slogan: 'Kaam. Connected.',
    areaServed: { '@type': 'City', name: 'Mumbai' },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Mumbai',
      addressRegion: 'Maharashtra',
      addressCountry: 'IN',
    },
    ...(GOOGLE_BUSINESS_URL ? { sameAs: [GOOGLE_BUSINESS_URL] } : {}),
  };
}

export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { '@id': ORG_ID },
  };
}

type ContractorForLd = {
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string;
  area: string;
  tradeTypes: string[];
  yearsInBusiness: number | null;
  bio: string | null;
};

export function contractorLd(c: ContractorForLd) {
  const trades = tradesOf(c.tradeTypes);
  return {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    name: c.name,
    url: `${SITE_URL}/contractors/${c.slug}`,
    ...(c.logoUrl ? { image: c.logoUrl, logo: c.logoUrl } : {}),
    ...(c.bio ? { description: c.bio } : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: c.area || c.city,
      addressRegion: 'Maharashtra',
      addressCountry: 'IN',
    },
    areaServed: { '@type': 'City', name: c.city || 'Mumbai' },
    ...(trades.length ? { knowsAbout: trades } : {}),
    ...(c.yearsInBusiness
      ? { foundingDate: String(new Date().getFullYear() - c.yearsInBusiness) }
      : {}),
  };
}

// "Home > Trades > Waterproofing" style trail for a page.
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}
