// src/components/ReportLink.tsx
//
// A small "Report" link to the report page, with what is being reported in
// the address (KALM-254). One page and one form serve every place a report
// can start, so there is a single thing to secure and test. nofollow keeps
// search engines from following report links.

import Link from 'next/link';

export default function ReportLink({
  type,
  id,
  children = 'Report',
  className = '',
}: {
  type: 'CONTRACTOR' | 'PROJECT' | 'MESSAGE';
  id: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={`/report?type=${type}&id=${encodeURIComponent(id)}`}
      rel="nofollow"
      className={`text-xs text-stone underline underline-offset-2 hover:text-ink transition-colors ${className}`}
    >
      {children}
    </Link>
  );
}
