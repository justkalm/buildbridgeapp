// src/app/contractors/[slug]/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import ProjectGallery from '@/components/ProjectGallery';
import ProjectLightbox from '@/components/ProjectLightbox';

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

type ContractorDetail = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string;
  area: string;
  tradeTypes: string[];
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  tier: 'LISTED' | 'PLUS' | 'PRO';
  yearsInBusiness: number | null;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  gstRegistered: boolean;
  insuranceCoverLakh: number | null;
  rating: number;
  reviewCount: number;
  licenseNumber: string;
  bio: string | null;
  projects: Project[];
};

export default function ContractorProfilePage() {
  const params = useParams<{ slug: string }>();
  const { status } = useSession();

  const [contractor, setContractor] = useState<ContractorDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [openProject, setOpenProject] = useState<Project | null>(null);

  const [projectType, setProjectType] = useState('');
  const [location, setLocation] = useState('');
  const [budgetRangeLabel, setBudgetRangeLabel] = useState('Under ₹50 L');
  const [details, setDetails] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    if (!params.slug) return;
    fetch(`/api/contractors/${params.slug}`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        if (data) {
          setContractor(data);
          setProjectType(data.tradeTypes[0] ?? '');
        }
      })
      .catch(() => setNotFound(true));
  }, [params.slug]);

  async function handleQuoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contractor) return;
    setSubmitting(true);
    setSubmitResult(null);

    try {
      const res = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractorId: contractor.id,
          projectType,
          location,
          budgetRangeLabel,
          details,
          contactPhone,
        }),
      });

      if (res.ok) {
        setSubmitResult('success');
        setDetails('');
        setLocation('');
        setContactPhone('');
      } else {
        setSubmitResult('error');
      }
    } catch {
      setSubmitResult('error');
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <>
        <Nav />
        <main className="flex-1 flex items-center justify-center py-24">
          <p className="text-stone">Contractor not found.</p>
        </main>
        <Footer />
      </>
    );
  }

  if (!contractor) {
    return (
      <>
        <Nav />
        <main className="flex-1 flex items-center justify-center py-24">
          <p className="text-stone text-sm">Loading…</p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />

      <header className="bg-paper text-ink border-b border-line pt-11 pb-9">
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="flex items-start gap-5 flex-wrap justify-between">
            <div className="flex gap-5">
              <div className="w-[84px] h-[84px] rounded-xl bg-paper-dim border border-line text-ink font-display text-3xl flex items-center justify-center shrink-0 overflow-hidden">
                {contractor.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external Blob URL
                  <img src={contractor.logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  contractor.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h1 className="font-display font-light text-[28px]">{contractor.name}</h1>
                  {contractor.verificationStatus === 'VERIFIED' && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-sage bg-sage-soft border border-sage/25 rounded-full px-2.5 py-1">
                      ✓ Verified
                    </span>
                  )}
                  {contractor.tier === 'PRO' && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-paper bg-ink rounded-full px-2.5 py-1 font-medium">
                      Pro
                    </span>
                  )}
                  {contractor.tier === 'PLUS' && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-ink bg-paper-dim border border-line rounded-full px-2.5 py-1 font-medium">
                      Plus
                    </span>
                  )}
                </div>
                <div className="flex gap-4 flex-wrap text-[13.5px] text-stone mb-3">
                  <span>📍 {contractor.area}, {contractor.city}</span>
                  <span>🏗️ {contractor.tradeTypes.join(', ')}</span>
                  {contractor.yearsInBusiness && <span>📅 {contractor.yearsInBusiness}+ years in business</span>}
                </div>
                {contractor.reviewCount > 0 && (
                  <div className="flex items-center gap-2.5">
                    <span className="text-ink text-base tracking-wide">
                      {'★'.repeat(Math.round(contractor.rating))}
                      {'☆'.repeat(5 - Math.round(contractor.rating))}
                    </span>
                    <span className="font-medium text-[15px]">{contractor.rating.toFixed(1)}</span>
                    <span className="text-stone text-[13.5px]">({contractor.reviewCount} reviews)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1440px] mx-auto px-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-11 py-12">
        <div>
          {contractor.bio && <p className="text-[15px] text-stone leading-relaxed mb-8">{contractor.bio}</p>}

          <h2 className="font-display text-xl mb-5">Completed Projects</h2>
          {contractor.projects.length === 0 ? (
            <p className="text-sm text-stone border border-line rounded-md p-6 bg-paper">
              No projects listed yet for this contractor.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {contractor.projects.map((p) => (
                <div
                  key={p.id}
                  className="border border-line rounded-md overflow-hidden bg-paper cursor-pointer hover:border-ink transition-colors"
                  onClick={() => setOpenProject(p)}
                >
                  <ProjectGallery imageUrls={p.imageUrls} />
                  <div className="p-4">
                    <h3 className="font-display text-[15px] mb-1">{p.title}</h3>
                    {(p.developerName || p.projectType || p.elevationFloors) && (
                      <p className="text-xs text-stone mb-3">
                        {[
                          p.developerName && `Developer: ${p.developerName}`,
                          p.projectType,
                          p.elevationFloors && `G+${p.elevationFloors}`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t border-line">
                      {p.squareFeet && (
                        <span className="font-medium text-sm text-ink">
                          {p.squareFeet.toLocaleString('en-IN')} sq ft
                        </span>
                      )}
                      {p.completedYear && <span className="text-xs text-stone">{p.completedYear}</span>}
                    </div>
                    {(p.committedDurationMonths || p.actualDurationMonths) && (
                      <p className="text-xs text-stone mt-2">
                        {p.committedDurationMonths && `Committed: ${p.committedDurationMonths} mo`}
                        {p.committedDurationMonths && p.actualDurationMonths && ' · '}
                        {p.actualDurationMonths && `Actual: ${p.actualDurationMonths} mo`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="bg-paper border border-line rounded-md p-6 mb-5">
            <h4 className="font-display text-[15.5px] mb-4">Business Details</h4>
            <dl className="text-[13.5px]">
              <div className="flex justify-between py-2.5 border-b border-line">
                <dt className="text-stone">License Number</dt>
                <dd className="text-xs font-medium">{contractor.licenseNumber}</dd>
              </div>
              {(contractor.teamSizeMin || contractor.teamSizeMax) && (
                <div className="flex justify-between py-2.5 border-b border-line">
                  <dt className="text-stone">Team Size</dt>
                  <dd className="font-medium">{contractor.teamSizeMin}–{contractor.teamSizeMax} workers</dd>
                </div>
              )}
              <div className="flex justify-between py-2.5 border-b border-line">
                <dt className="text-stone">GST Registered</dt>
                <dd className="font-medium">{contractor.gstRegistered ? 'Yes' : 'Not disclosed'}</dd>
              </div>
              {contractor.insuranceCoverLakh && (
                <div className="flex justify-between py-2.5">
                  <dt className="text-stone">Insurance Cover</dt>
                  <dd className="font-medium">₹{contractor.insuranceCoverLakh} L</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-paper border border-line rounded-md p-6 sticky top-24">
            <h4 className="font-display text-[15.5px] mb-4">Request a Quotation</h4>

            {status === 'loading' ? null : status !== 'authenticated' ? (
              <div>
                <p className="text-sm text-stone mb-4">Sign in to request a quote from this contractor.</p>
                <Link
                  href="/signup"
                  className="block text-center bg-ink text-paper font-medium text-sm py-3 rounded-full hover:bg-stone transition-colors"
                >
                  Sign up to continue
                </Link>
              </div>
            ) : submitResult === 'success' ? (
              <div className="text-sm">
                <p className="text-sage font-medium mb-1">Request sent.</p>
                <p className="text-stone">
                  {contractor.name} will be notified and can reach out to discuss your project.
                </p>
              </div>
            ) : (
              <form onSubmit={handleQuoteSubmit} className="flex flex-col gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-stone mb-1.5">Project type</label>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="w-full px-3 py-2.5 border border-line rounded-[4px] text-[13.5px] bg-paper"
                  >
                    {contractor.tradeTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone mb-1.5">Location</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Area, City"
                    className="w-full px-3 py-2.5 border border-line rounded-[4px] text-[13.5px] bg-paper"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone mb-1.5">Estimated budget</label>
                  <select
                    value={budgetRangeLabel}
                    onChange={(e) => setBudgetRangeLabel(e.target.value)}
                    className="w-full px-3 py-2.5 border border-line rounded-[4px] text-[13.5px] bg-paper"
                  >
                    <option>Under ₹50 L</option>
                    <option>₹50 L – ₹1 Cr</option>
                    <option>₹1 Cr – ₹3 Cr</option>
                    <option>₹3 Cr+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone mb-1.5">Project details</label>
                  <textarea
                    required
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Timeline, scope..."
                    rows={3}
                    className="w-full px-3 py-2.5 border border-line rounded-[4px] text-[13.5px] bg-paper resize-y"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone mb-1.5">Phone number</label>
                  <input
                    type="tel"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 00000 00000"
                    className="w-full px-3 py-2.5 border border-line rounded-[4px] text-[13.5px] bg-paper"
                  />
                </div>

                {submitResult === 'error' && (
                  <p className="text-sm text-red-600">Something went wrong. Please try again.</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 bg-ink text-paper font-medium text-sm py-3 rounded-full hover:bg-stone transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Sending…' : 'Send Request'}
                </button>
                <p className="text-[11.5px] text-stone leading-relaxed">
                  {contractor.name} will be notified and can reach out directly to discuss.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      <Footer />

      {openProject && (
        <ProjectLightbox project={openProject} onClose={() => setOpenProject(null)} />
      )}
    </>
  );
}
