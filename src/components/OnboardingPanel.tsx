// src/components/OnboardingPanel.tsx
//
// Task sheet H: tells a new contractor (1) whether their profile is live and,
// if not, why, and (2) what to fill in so the profile looks complete.
//
// Two separate things on purpose, so the page stays honest:
//   - LIVE or not depends ONLY on verification (Browse lists VERIFIED
//     contractors only, see src/app/api/contractors/route.ts). Nothing the
//     contractor ticks off here changes that; our team does the checks.
//   - The checklist is about a profile developers can trust. It never
//     gates anything.
// Not on the checklist, deliberately: the logo (only admin can upload it
// today) and data-sharing consent (optional, so we never nudge it).

import Link from 'next/link';

export type OnboardingData = {
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  emailVerified: boolean;
  bio: string | null;
  yearsInBusiness: number | null;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  projectCount: number;
};

type Step = { label: string; done: boolean; href?: string; action?: string };

export default function OnboardingPanel({ data }: { data: OnboardingData }) {
  const steps: Step[] = [
    {
      label: 'Verify your email',
      done: data.emailVerified,
    },
    {
      label: 'Write a short bio about your business',
      done: !!data.bio?.trim(),
      href: '/contractor/profile',
      action: 'Edit profile',
    },
    {
      label: 'Add your years in business',
      done: data.yearsInBusiness != null,
      href: '/contractor/profile',
      action: 'Edit profile',
    },
    {
      label: 'Add your team size',
      done: data.teamSizeMin != null || data.teamSizeMax != null,
      href: '/contractor/profile',
      action: 'Edit profile',
    },
    {
      label: 'Add at least one completed project',
      done: data.projectCount > 0,
      href: '/contractor/projects',
      action: 'Add project',
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const isLive = data.verificationStatus === 'VERIFIED';

  if (isLive && allDone) return null;

  return (
    <div className="mb-6 flex flex-col gap-3">
      {!isLive && (
        <div
          className={`px-4 py-3 rounded-[6px] text-[13.5px] ${
            data.verificationStatus === 'REJECTED' ? 'bg-danger-soft text-danger' : 'bg-paper-dim text-ink'
          }`}
        >
          <p className="font-medium mb-1">
            Your profile isn&apos;t live yet.{' '}
            {data.verificationStatus === 'REJECTED' ? 'Your verification was not approved.' : 'Verification is pending.'}
          </p>
          {data.verificationStatus === 'PENDING' ? (
            <>
              <p className="text-stone mb-1.5">
                Developers can only find contractors who are Verified. Before we mark you Verified, our team:
              </p>
              <ul className="list-disc pl-5 text-stone space-y-0.5 mb-1.5">
                <li>reviews copies of your licence, GST and registration documents</li>
                <li>checks your GSTIN on the GST portal</li>
                <li>speaks with you directly, by phone or in person</li>
              </ul>
              <p className="text-stone">
                There is nothing to tick here to go live. Keep your phone reachable and your profile below complete, and
                we will be in touch.
              </p>
            </>
          ) : (
            <p>
              Please{' '}
              <Link href="/contact" className="underline underline-offset-2">
                contact us
              </Link>{' '}
              and we will tell you what was missing.
            </p>
          )}
        </div>
      )}

      {!allDone && (
        <div className="px-4 py-3 rounded-[6px] border border-line">
          <p className="text-[13.5px] font-medium mb-2">
            Complete your profile{' '}
            <span className="text-stone font-normal">
              ({doneCount} of {steps.length} done)
            </span>
          </p>
          <ul className="flex flex-col gap-1.5">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-[13px]">
                <span
                  aria-hidden
                  className={`inline-flex w-4 h-4 rounded-full items-center justify-center text-[10px] shrink-0 ${
                    s.done ? 'bg-sage-soft text-sage' : 'border border-line text-transparent'
                  }`}
                >
                  ✓
                </span>
                <span className={s.done ? 'text-stone line-through' : ''}>
                  {s.label}
                  <span className="sr-only">{s.done ? ' (done)' : ' (to do)'}</span>
                </span>
                {!s.done && s.href && (
                  <Link href={s.href} className="ml-auto text-xs underline underline-offset-2 hover:text-ink text-stone">
                    {s.action}
                  </Link>
                )}
                {!s.done && !s.href && (
                  <span className="ml-auto text-xs text-stone">Check your inbox for the link</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
