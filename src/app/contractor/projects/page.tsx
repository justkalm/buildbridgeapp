// src/app/contractor/projects/page.tsx
//
// Self-service project add/edit/delete. Mirrors the inline project-editor
// pattern from src/app/admin/contractors/new/page.tsx, but operating on
// already-saved projects (fetch, then PATCH/DELETE per project) instead of
// building up an array for one create-time submission.
//
// Deliberately does NOT reset verificationStatus on any project change —
// see the file header comment on the projects API route for why.

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import ImageUpload from '@/components/ImageUpload';

type Project = {
  id: string;
  title: string;
  developerName: string | null;
  projectType: string | null;
  completedYear: number | null;
  squareFeet: number | null;
  elevationFloors: number | null;
  committedDurationMonths: number | null;
  actualDurationMonths: number | null;
  imageUrls: string[];
};

type NewProjectDraft = Omit<Project, 'id'>;

const emptyDraft = (): NewProjectDraft => ({
  title: '',
  developerName: '',
  projectType: '',
  completedYear: null,
  squareFeet: null,
  elevationFloors: null,
  committedDurationMonths: null,
  actualDurationMonths: null,
  imageUrls: [],
});

const inputCls =
  'w-full px-3 py-2 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink';

export default function ContractorProjectsPage() {
  const { status: sessionStatus, data: session } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [draft, setDraft] = useState<NewProjectDraft>(emptyDraft());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/login');
    if (
      sessionStatus === 'authenticated' &&
      (session?.user as { role?: string })?.role !== 'contractor'
    ) {
      router.push('/browse');
    }
  }, [sessionStatus, session, router]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    fetch('/api/contractors/me/projects')
      .then((res) => (res.ok ? res.json() : []))
      .then(setProjects);
  }, [sessionStatus]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) {
      setError('Title is required');
      return;
    }
    setAdding(true);
    setError(null);

    const res = await fetch('/api/contractors/me/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });

    if (res.ok) {
      const created = await res.json();
      setProjects((prev) => (prev ? [created, ...prev] : [created]));
      setDraft(emptyDraft());
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to add project');
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    const res = await fetch(`/api/contractors/me/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setProjects((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    } else {
      alert('Failed to delete project. Please try again.');
    }
  }

  if (sessionStatus !== 'authenticated' || !projects) {
    return null;
  }

  return (
    <>
      <Nav />
      <main className="flex-1 max-w-[760px] mx-auto px-8 py-10 w-full">
        <Link href="/contractor/dashboard" className="text-sm text-stone hover:text-ink mb-6 inline-block">
          ← Back to dashboard
        </Link>
        <h1 className="font-display font-light text-[28px] mb-2">Your projects</h1>
        <p className="text-stone text-sm mb-8">
          Completed projects show on your public profile as proof of past work. Adding or editing
          a project doesn&apos;t affect your listing&apos;s verification status.
        </p>

        {projects.length > 0 && (
          <div className="flex flex-col gap-4 mb-10">
            {projects.map((p) => (
              <div key={p.id} className="border border-line rounded-[6px] p-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="font-medium text-sm">{p.title}</p>
                    <p className="text-xs text-stone mt-1">
                      {[p.projectType, p.completedYear ? `Completed ${p.completedYear}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-xs text-red-600 hover:text-red-800 shrink-0"
                  >
                    Delete
                  </button>
                </div>
                {p.imageUrls.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {p.imageUrls.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element -- external Blob URL
                      <img key={url} src={url} alt="" className="w-14 h-14 rounded-md object-cover border border-line" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-line pt-8">
          <h2 className="font-display font-light text-xl mb-4">Add a project</h2>
          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <input
              placeholder="Project title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Developer name (optional)"
                value={draft.developerName ?? ''}
                onChange={(e) => setDraft({ ...draft, developerName: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Project type, e.g. Residential, 18 floors"
                value={draft.projectType ?? ''}
                onChange={(e) => setDraft({ ...draft, projectType: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                placeholder="Sq ft"
                value={draft.squareFeet ?? ''}
                onChange={(e) => setDraft({ ...draft, squareFeet: e.target.value ? Number(e.target.value) : null })}
                className={inputCls}
              />
              <input
                type="number"
                placeholder="Floors"
                value={draft.elevationFloors ?? ''}
                onChange={(e) => setDraft({ ...draft, elevationFloors: e.target.value ? Number(e.target.value) : null })}
                className={inputCls}
              />
              <input
                type="number"
                placeholder="Completed year"
                value={draft.completedYear ?? ''}
                onChange={(e) => setDraft({ ...draft, completedYear: e.target.value ? Number(e.target.value) : null })}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Committed duration (months)"
                value={draft.committedDurationMonths ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, committedDurationMonths: e.target.value ? Number(e.target.value) : null })
                }
                className={inputCls}
              />
              <input
                type="number"
                placeholder="Actual duration (months)"
                value={draft.actualDurationMonths ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, actualDurationMonths: e.target.value ? Number(e.target.value) : null })
                }
                className={inputCls}
              />
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              {draft.imageUrls.map((url) => (
                <div key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- external Blob URL */}
                  <img src={url} alt="" className="w-16 h-16 rounded-md object-cover border border-line" />
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, imageUrls: draft.imageUrls.filter((u) => u !== url) })}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white text-xs leading-5 text-center"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="w-40">
                <ImageUpload
                  label={draft.imageUrls.length === 0 ? 'Add photo' : 'Add another'}
                  value={null}
                  onChange={(url) => url && setDraft({ ...draft, imageUrls: [...draft.imageUrls, url] })}
                  uploadUrl="/api/contractors/upload"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={adding}
              className="mt-2 bg-ink text-paper font-medium text-sm py-2.5 rounded-full hover:bg-stone transition-colors disabled:opacity-60 self-start px-6"
            >
              {adding ? 'Adding…' : 'Add project'}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
