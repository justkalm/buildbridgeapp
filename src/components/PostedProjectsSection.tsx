'use client';

// "Posted projects" at the top of "Your projects" on the developer dashboard:
// every project the developer sent through "Post a project", with a plain
// progress line (received, sent to how many contractors, who replied).
// Read-only. Data comes from GET /api/developers/project-posts, which gives
// counts and the contractors who have already written back, never which
// contractors were alerted and never contact details.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { displayBudget } from '@/lib/budget';

type PostedProject = {
  id: string;
  projectType: string;
  location: string;
  budgetRangeLabel: string;
  status: 'NEW' | 'MATCHED' | 'CLOSED';
  createdAt: string;
  alertedCount: number;
  replies: { id: string; contractorName: string }[];
};

function Step({ reached, label, last = false }: { reached: boolean; label: string; last?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`inline-block w-2 h-2 rounded-full border ${reached ? 'bg-ink border-ink' : 'border-line bg-paper'}`}
      />
      <span className={`text-xs ${reached ? 'text-ink' : 'text-stone'}`}>{label}</span>
      {!last && <span aria-hidden="true" className="hidden sm:block w-6 h-px bg-line" />}
    </li>
  );
}

export default function PostedProjectsSection() {
  const [posts, setPosts] = useState<PostedProject[] | null>(null);

  useEffect(() => {
    fetch('/api/developers/project-posts')
      .then((r) => (r.ok ? r.json() : []))
      .then(setPosts)
      .catch(() => setPosts([]));
  }, []);

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h2 className="font-display font-light text-xl">Posted projects</h2>
        <Link
          href="/post-project"
          className="text-xs font-medium px-4 py-2 rounded-full border border-line hover:border-ink transition-colors"
        >
          Post a project
        </Link>
      </div>
      <p className="text-sm text-stone mb-4">
        Projects you have sent to (kalm). We read each one and introduce you to contractors by hand.
      </p>

      {posts !== null && posts.length === 0 && (
        <p className="text-sm text-stone">Nothing posted yet.</p>
      )}

      {posts !== null && posts.length > 0 && (
        <div className="flex flex-col gap-3">
          {posts.map((p) => {
            const sent = p.alertedCount > 0;
            const replied = p.replies.length;
            return (
              <div key={p.id} className="border border-line rounded-[6px] p-4">
                <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
                  <div>
                    <p className="font-medium text-sm">{p.projectType}</p>
                    <p className="text-stone text-xs mt-0.5">
                      {p.location} · {displayBudget(p.budgetRangeLabel)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.status === 'CLOSED' && (
                      <span className="inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-line/60 text-stone">
                        Closed
                      </span>
                    )}
                    <span className="text-xs text-stone">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5" aria-label="Progress">
                  <Step reached label="Received" />
                  <Step
                    reached={sent}
                    label={sent ? `Sent to ${p.alertedCount} contractor${p.alertedCount === 1 ? '' : 's'}` : 'Being matched'}
                  />
                  <Step
                    reached={replied > 0}
                    label={replied > 0 ? `${replied} ${replied === 1 ? 'reply' : 'replies'}` : 'No replies yet'}
                    last
                  />
                </ol>

                {replied > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-line">
                    {p.replies.map((r) => (
                      <Link
                        key={r.id}
                        href={`/messages/${r.id}`}
                        className="text-xs text-ink underline underline-offset-2 hover:text-stone"
                      >
                        Open conversation with {r.contractorName}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
