// src/app/report/page.tsx
//
// "Report content or contact us" (KALM-254, 256). Open to everyone, logged in
// or not. The Report links on profiles, projects and message threads send
// people here with ?type= and ?id= filled in; arriving without them gives a
// general report. Posts to /api/reports.
//
// The grievance contact is named with the person's agreement (owner, 6 Oct
// 2026). The wording here deliberately promises no response time and cites no
// law: those need the company to exist and a lawyer to confirm.
//
// Layout: the page shell and the grievance contact sit OUTSIDE the Suspense
// boundary, so they are in the server-rendered HTML (visible without
// JavaScript and to crawlers). Only the form, which reads the address and the
// login session, waits inside it.

'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { REPORT_REASONS, REPORT_REASON_KEYS, type ReportReason } from '@/lib/reports';
import { VERIFICATION_EMAIL } from '@/lib/site';

const TARGET_LABEL: Record<string, string> = {
  CONTRACTOR: 'a contractor profile',
  PROJECT: 'a project',
  MESSAGE: 'a message conversation',
};

const inputCls =
  'w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink';

function ReportForm() {
  const params = useSearchParams();
  const { status: sessionStatus } = useSession();
  const loggedIn = sessionStatus === 'authenticated';

  const rawType = params.get('type') ?? '';
  const id = params.get('id') ?? '';
  // hasOwn, not `in`: a link like ?type=__proto__ must not match anything.
  const targetType = Object.hasOwn(TARGET_LABEL, rawType) && id ? rawType : 'OTHER';

  const [reason, setReason] = useState<ReportReason>('illegal');
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  // The page thinks you are logged in but the server does not (an expired
  // session): the server then asks for an email, and we show the field.
  const [serverWantsEmail, setServerWantsEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showEmail = !loggedIn || serverWantsEmail;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId: targetType === 'OTHER' ? undefined : id,
          reason,
          details: details || undefined,
          email: showEmail ? email || undefined : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 400 && typeof data.error === 'string' && data.error.includes('email address')) {
          setServerWantsEmail(true);
        }
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div>
        <h2 className="font-display text-xl text-ink mb-2">Report received</h2>
        <p className="text-sm text-stone">Thank you. Our team will look into it.</p>
      </div>
    );
  }

  return (
    <>
      <h2 className="font-display text-xl text-ink mb-2">Send a report</h2>
      {targetType !== 'OTHER' && (
        <p className="text-sm text-stone mb-5">You are reporting {TARGET_LABEL[targetType]}.</p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="reason" className="block text-sm font-medium mb-1.5">
            What is the problem?
          </label>
          <select
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as ReportReason)}
            className={inputCls}
          >
            {REPORT_REASON_KEYS.map((k) => (
              <option key={k} value={k}>
                {REPORT_REASONS[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="details" className="block text-sm font-medium mb-1.5">
            What did you see?{' '}
            <span className="font-normal text-stone">
              {reason === 'other' || targetType === 'OTHER' ? '(required)' : '(optional)'}
            </span>
          </label>
          <textarea
            id="details"
            rows={5}
            maxLength={2000}
            required={reason === 'other' || targetType === 'OTHER'}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className={inputCls}
          />
        </div>
        {showEmail && (
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              Your email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
            <p className="text-xs text-stone mt-1.5">So we can reach you if we need more detail.</p>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 text-sm rounded-[4px] bg-ink text-paper disabled:opacity-50"
        >
          {submitting ? 'Sending...' : 'Send report'}
        </button>
      </form>
    </>
  );
}

export default function ReportPage() {
  return (
    <>
      <Nav />

      <header className="pt-28 pb-16 text-center">
        <div className="max-w-[680px] mx-auto px-5 sm:px-8">
          <h1 className="font-display font-light text-[clamp(32px,4vw,46px)] leading-[1.15] text-ink mb-4">
            Report something.
          </h1>
          <p className="text-[17px] leading-relaxed text-stone">
            If you see something on (kalm) that is illegal, abusive, fake or does not belong here, tell us. Say what it
            is and where you saw it.
          </p>
        </div>
      </header>

      <section className="pb-24 border-t border-line pt-16">
        <div className="max-w-[880px] mx-auto px-5 sm:px-8 grid grid-cols-1 md:grid-cols-2 gap-16">
          <div>
            <h2 className="font-display text-xl text-ink mb-6">Write to us directly</h2>
            <p className="text-xs text-stone uppercase tracking-wide mb-1">Grievance contact</p>
            <p className="text-sm font-medium text-ink">Shaheer Motorwala</p>
            <a href={`mailto:${VERIFICATION_EMAIL}`} className="text-sm text-stone hover:text-ink transition-colors">
              {VERIFICATION_EMAIL}
            </a>
            <p className="text-sm text-stone mt-6 leading-relaxed">
              For anything that is not about one profile, project or message, or if you would rather email than use the
              form, write to this address.
            </p>
          </div>

          <div>
            <Suspense fallback={null}>
              <ReportForm />
            </Suspense>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
