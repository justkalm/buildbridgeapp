// src/app/dashboard/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

type QuoteRequestRow = {
  id: string;
  projectType: string;
  location: string;
  status: 'PENDING' | 'CONTACTED' | 'DECLINED';
  createdAt: string;
  emailSentAt: string | null;
  contractor: { id: string; name: string; slug: string };
};

const statusLabel: Record<QuoteRequestRow['status'], string> = {
  PENDING: 'Awaiting response',
  CONTACTED: 'Contractor reached out',
  DECLINED: 'No response',
};

const statusStyle: Record<QuoteRequestRow['status'], string> = {
  PENDING: 'bg-sage-soft text-sage',
  CONTACTED: 'bg-sage-soft text-sage',
  DECLINED: 'bg-paper-dim text-stone',
};

export default function DashboardPage() {
  const { status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<QuoteRequestRow[] | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/quote-requests/mine')
      .then((res) => (res.ok ? res.json() : []))
      .then(setRequests);
  }, [status]);

  if (status !== 'authenticated') {
    return null;
  }

  return (
    <>
      <Nav />
      <main className="flex-1 max-w-[1440px] mx-auto px-8 py-10 w-full">
        <div className="flex justify-between items-start flex-wrap gap-4 mb-9">
          <div>
            <h1 className="font-display font-light text-[28px] mb-1">Your Quotation Requests</h1>
            <p className="text-stone text-[14.5px]">Every request you&apos;ve sent, and its status.</p>
          </div>
          <Link
            href="/browse"
            className="inline-flex items-center justify-center text-sm px-5 py-2.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
          >
            Browse Contractors
          </Link>
        </div>

        {requests === null ? (
          <p className="text-sm text-stone">Loading…</p>
        ) : requests.length === 0 ? (
          <div className="border border-line rounded-md p-10 text-center bg-paper">
            <p className="text-stone font-medium mb-1">No quote requests yet</p>
            <p className="text-sm text-stone mb-4">Browse contractors and request a quote to get started.</p>
            <Link href="/browse" className="text-ink font-medium text-sm">
              Browse Contractors →
            </Link>
          </div>
        ) : (
          <div className="bg-paper border border-line rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] tracking-wider uppercase text-stone">
                  <th className="px-4 py-3 border-b border-line">Contractor</th>
                  <th className="px-4 py-3 border-b border-line">Project</th>
                  <th className="px-4 py-3 border-b border-line">Sent</th>
                  <th className="px-4 py-3 border-b border-line">Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-4">
                      <Link href={`/contractors/${r.contractor.slug}`} className="font-medium hover:text-stone transition-colors">
                        {r.contractor.name}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-stone">
                      {r.projectType} · {r.location}
                    </td>
                    <td className="px-4 py-4 text-stone">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block text-[11.5px] font-medium px-2.5 py-1 rounded-full ${statusStyle[r.status]}`}>
                        {statusLabel[r.status]}
                      </span>
                      {!r.emailSentAt && (
                        <p className="text-[11px] text-red-600 mt-1">
                          Notification may not have been delivered
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
