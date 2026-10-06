// src/app/admin/leads/[contractorId]/page.tsx
//
// Lead report for one contractor and month, laid out to be printed or saved as
// a PDF (browser Print) and sent to the contractor, or copied as plain text for
// WhatsApp. Admin only. The page shell is a server component that reads the
// address; the report itself loads in ReportView.

import ReportView from './report-view';

export default async function LeadReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ contractorId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { contractorId } = await params;
  const { month } = await searchParams;
  return <ReportView contractorId={contractorId} month={month ?? null} />;
}
