// src/app/contractors/[slug]/layout.tsx
//
// The link preview for a contractor's profile: when someone pastes
// /contractors/<slug> into WhatsApp (or another chat app), the card shows
// the contractor's name, trades, area and years in business, with their
// logo when they have one. The profile page itself is a client component,
// and only server code can set previews, so this thin layout does it.
//
// Mirrors the public profile API: only VERIFIED contractors have a public
// profile, so anyone else gets the plain (kalm) preview and reveals
// nothing. Link-preview bots (WhatsApp, Facebook, Slack...) get the tags in
// the page head; Next.js does that automatically for known bots.

import type { Metadata } from 'next';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { tradesOf } from '@/lib/trade-types';

const getContractor = cache((slug: string) =>
  prisma.contractor.findFirst({
    where: { slug, verificationStatus: 'VERIFIED' },
    select: { name: true, city: true, area: true, tradeTypes: true, yearsInBusiness: true, logoUrl: true },
  })
);

export async function generateMetadata({ params }: LayoutProps<'/contractors/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const c = await getContractor(slug);
  if (!c) return { title: 'Contractor' };

  const trades = tradesOf(c.tradeTypes);
  const place = [c.area, c.city].filter(Boolean).join(', ');
  // e.g. "Fire & Life Safety contractor in Mazagaon, Mumbai · 20+ years.
  // Verified on (kalm): see completed projects, request a quote."
  const lead = [
    trades.length ? `${trades.slice(0, 3).join(', ')}${trades.length > 3 ? ' and more' : ''}` : 'Contractor',
    place ? `in ${place}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const years = c.yearsInBusiness ? ` · ${c.yearsInBusiness}+ years` : '';
  const description = `${lead}${years}. Verified on (kalm): see their completed projects and request a quote.`;
  const image = c.logoUrl
    ? { url: c.logoUrl, alt: `${c.name} logo` }
    : { url: '/icon-512.png', width: 512, height: 512, alt: '(kalm)' };

  return {
    title: c.name,
    description,
    openGraph: { type: 'profile', title: `${c.name} | (kalm)`, description, images: [image], url: `/contractors/${slug}` },
    twitter: { card: 'summary', title: `${c.name} | (kalm)`, description, images: [image.url] },
  };
}

export default function ContractorProfileLayout({ children }: LayoutProps<'/contractors/[slug]'>) {
  return children;
}
