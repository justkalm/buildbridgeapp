// src/app/contractors/[slug]/page.tsx
//
// Public contractor profile. Loads the contractor on the server (same rules
// as the profile API, src/lib/public-contractor.ts) so the full profile is
// in the HTML search engines download, then hands it to the interactive
// client component. An unknown or unverified slug is a real 404, not a
// "not found" message on a 200 page (which Google reports as a soft 404).

import { notFound } from 'next/navigation';
import JsonLd from '@/components/JsonLd';
import { getPublicContractor } from '@/lib/public-contractor';
import { breadcrumbLd, contractorLd } from '@/lib/structured-data';
import ContractorProfile from './ContractorProfile';

export default async function ContractorProfilePage({ params }: PageProps<'/contractors/[slug]'>) {
  const { slug } = await params;
  const contractor = await getPublicContractor(slug);
  if (!contractor) notFound();

  return (
    <>
      <JsonLd data={contractorLd(contractor)} />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Contractors', path: '/browse' },
          { name: contractor.name, path: `/contractors/${contractor.slug}` },
        ])}
      />
      <ContractorProfile contractor={contractor} />
    </>
  );
}
