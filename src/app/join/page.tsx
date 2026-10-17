// src/app/join/page.tsx
//
// The contractor onboarding form (16 Oct 2026). No account and no password:
// the team sends this link on WhatsApp or email, the contractor fills it in
// on their phone, and admin turns it into a listing by hand from
// /admin/applications. The fields are the ones the owner listed: business
// name, phone, email, bio, logo, trades, GST, licence (optional), an
// insurance yes/no, and 3 to 5 projects, each with its name, the developer
// it was for and 2 to 6 photos (owner's rule, 16 Oct 2026). Area is asked as well,
// because a listing can't go live or be verified without one.
//
// Photos upload as soon as they are picked (ImageUpload, pointed at
// /api/join/upload), so pressing Send only carries the photo URLs. Send is
// disabled while any upload is still running, otherwise that photo would be
// dropped. Field rules match src/lib/join-form.ts, which the API applies.

'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import AreaPicker from '@/components/AreaPicker';
import ImageUpload from '@/components/ImageUpload';
import TradeTypePicker from '@/components/TradeTypePicker';
import { normalizeLocation } from '@/lib/location';
import { tradeOf } from '@/lib/trade-types';
import {
  JOIN_MAX_BIO,
  JOIN_MAX_PHOTOS_PER_PROJECT,
  JOIN_MAX_PROJECTS,
  JOIN_MIN_PHOTOS_PER_PROJECT,
  JOIN_MIN_PROJECTS,
} from '@/lib/join-form';

const UPLOAD_URL = '/api/join/upload';

const inputClass =
  'w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink';

type ProjectDraft = {
  name: string;
  developerName: string;
  area: string;
  builtUpArea: string; // as typed; sent as a whole number
  siteVisitPossible: boolean | null;
  imageUrls: string[];
};

const emptyProject = (): ProjectDraft => ({
  name: '',
  developerName: '',
  area: '',
  builtUpArea: '',
  siteVisitPossible: null,
  imageUrls: [],
});

// "45,000" or "45000 sq ft" both read as 45000.
function sqftOf(typed: string): number {
  return Number(typed.replace(/[^0-9]/g, ''));
}

function YesNo({
  value,
  onChange,
  labelledBy,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  labelledBy: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex gap-2">
      {([true, false] as const).map((option) => (
        <button key={String(option)} type="button" role="radio" aria-checked={value === option}
          onClick={() => onChange(option)}
          className={`text-sm px-5 py-2 rounded-full border ${
            value === option ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink'
          }`}>
          {option ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  );
}

export default function JoinPage() {
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [area, setArea] = useState('');
  const [bio, setBio] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [tradeTypes, setTradeTypes] = useState<string[]>([]);
  const [gstNumber, setGstNumber] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [projects, setProjects] = useState<ProjectDraft[]>(() =>
    Array.from({ length: JOIN_MIN_PROJECTS }, emptyProject)
  );
  const [hasInsurance, setHasInsurance] = useState<boolean | null>(null);
  const [consent, setConsent] = useState(false);

  // Counts uploads in flight across every ImageUpload on the page.
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  function onUploadState(isUploading: boolean) {
    setUploading((n) => Math.max(0, n + (isUploading ? 1 : -1)));
  }

  function updateProject<K extends 'name' | 'developerName' | 'area' | 'builtUpArea' | 'siteVisitPossible'>(
    index: number,
    field: K,
    value: ProjectDraft[K]
  ) {
    setProjects((p) => p.map((proj, i) => (i === index ? { ...proj, [field]: value } : proj)));
  }

  function addPhoto(index: number, url: string) {
    setProjects((p) => p.map((proj, i) => (i === index ? { ...proj, imageUrls: [...proj.imageUrls, url] } : proj)));
  }

  function removePhoto(index: number, url: string) {
    setProjects((p) =>
      p.map((proj, i) => (i === index ? { ...proj, imageUrls: proj.imageUrls.filter((u) => u !== url) } : proj))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (tradeTypes.filter((t) => tradeOf(t) !== null).length === 0) {
      setError('Pick your trade and tick at least one speciality.');
      return;
    }

    if (hasInsurance === null) {
      setError('Tell us whether you have insurance (Yes or No).');
      return;
    }

    // Every project box shown must be complete: there are only ever 3 to 5,
    // and all of them are required.
    const unnamedIndex = projects.findIndex((p) => !p.name.trim());
    if (unnamedIndex !== -1) {
      setError(`Give project ${unnamedIndex + 1} a name.`);
      return;
    }
    const noAreaIndex = projects.findIndex((p) => !p.area.trim());
    if (noAreaIndex !== -1) {
      setError(`Pick where project ${noAreaIndex + 1} is.`);
      return;
    }
    const noSqftIndex = projects.findIndex((p) => !(sqftOf(p.builtUpArea) > 0));
    if (noSqftIndex !== -1) {
      setError(`Enter the built-up area of project ${noSqftIndex + 1} in sq ft.`);
      return;
    }
    const noVisitIndex = projects.findIndex((p) => p.siteVisitPossible === null);
    if (noVisitIndex !== -1) {
      setError(`Tell us whether you can arrange a site visit at project ${noVisitIndex + 1}.`);
      return;
    }
    const fewPhotosIndex = projects.findIndex((p) => p.imageUrls.length < JOIN_MIN_PHOTOS_PER_PROJECT);
    if (fewPhotosIndex !== -1) {
      setError(`Add at least ${JOIN_MIN_PHOTOS_PER_PROJECT} photos to project ${fewPhotosIndex + 1}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          phone,
          email,
          area: normalizeLocation(area),
          bio,
          logoUrl: logoUrl || undefined,
          tradeTypes,
          gstNumber,
          licenceNumber: licenceNumber || undefined,
          hasInsurance,
          projects: projects.map((p) => ({
            name: p.name,
            developerName: p.developerName || undefined,
            area: normalizeLocation(p.area),
            builtUpAreaSqft: sqftOf(p.builtUpArea),
            siteVisitPossible: p.siteVisitPossible,
            imageUrls: p.imageUrls,
          })),
          consent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }
      setSent(true);
      window.scrollTo({ top: 0 });
    } catch {
      setError('Something went wrong. Please check your internet and try again.');
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <>
        <Nav />
        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-[420px] text-center">
            <h1 className="font-display font-light text-2xl mb-3">Thank you</h1>
            <p className="text-stone text-sm">
              We have your details. Our team will check them and set up your (kalm) listing. When
              it is ready, we will email you a link to set your password and open your dashboard.
            </p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="flex-1 flex justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-[520px]">
          <h1 className="font-display font-light text-3xl mb-2">Join (kalm)</h1>
          <p className="text-stone text-sm mb-8">
            Tell us about your business and the projects you have done. Our team will check the
            details and set up your listing for you. No account or password needed.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <fieldset className="flex flex-col gap-4">
              <legend className="font-display text-base mb-3">Your business</legend>
              <div>
                <label htmlFor="join-name" className="block text-sm font-medium mb-1.5">Business name</label>
                <input id="join-name" type="text" required maxLength={200} value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="join-phone" className="block text-sm font-medium mb-1.5">Phone</label>
                <input id="join-phone" type="tel" required maxLength={20} value={phone}
                  onChange={(e) => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX" className={inputClass} />
              </div>
              <div>
                <label htmlFor="join-email" className="block text-sm font-medium mb-1.5">Email</label>
                <input id="join-email" type="email" required maxLength={320} value={email}
                  onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="join-area" className="block text-sm font-medium mb-1.5">Area in Mumbai</label>
                <AreaPicker id="join-area" value={area} onChange={setArea} className={inputClass} />
                <p className="text-xs text-stone mt-1">Where your business is based.</p>
              </div>
              <div>
                <label htmlFor="join-bio" className="block text-sm font-medium mb-1.5">
                  About your business
                </label>
                <textarea id="join-bio" rows={4} required minLength={30} maxLength={JOIN_MAX_BIO} value={bio}
                  onChange={(e) => setBio(e.target.value)} className={inputClass}
                  placeholder="What you do, how long you have been doing it, the kind of projects you take on" />
              </div>
              <ImageUpload label="Logo (optional)" value={logoUrl} onChange={setLogoUrl}
                onUploadStateChange={onUploadState} uploadUrl={UPLOAD_URL} shrinkLargePhotos />
            </fieldset>

            <fieldset className="pt-6 border-t border-line">
              <legend className="font-display text-base mb-1">Your trade</legend>
              <p className="text-xs text-stone mb-3">Pick your trade, then tick the work you do.</p>
              <TradeTypePicker selected={tradeTypes} onChange={setTradeTypes} />
            </fieldset>

            <fieldset className="flex flex-col gap-4 pt-6 border-t border-line">
              <legend className="font-display text-base mb-1">Registration</legend>
              <p className="text-xs text-stone -mt-2">
                We check these before we mark a listing Verified.
              </p>
              <div>
                <label htmlFor="join-gst" className="block text-sm font-medium mb-1.5">
                  GST number
                </label>
                <input id="join-gst" type="text" required maxLength={20} value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)} placeholder="27ABCDE1234F1Z5"
                  autoCapitalize="characters" className={inputClass} />
              </div>
              <div>
                <label htmlFor="join-licence" className="block text-sm font-medium mb-1.5">
                  Licence number <span className="text-stone font-normal">(optional)</span>
                </label>
                <input id="join-licence" type="text" maxLength={100} value={licenceNumber}
                  onChange={(e) => setLicenceNumber(e.target.value)} className={inputClass} />
              </div>
              <div>
                <p id="join-insurance-label" className="block text-sm font-medium mb-1.5">
                  Do you have insurance for your work?
                </p>
                <YesNo value={hasInsurance} onChange={setHasInsurance} labelledBy="join-insurance-label" />
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-4 pt-6 border-t border-line">
              <legend className="font-display text-base mb-1">Your projects</legend>
              <p className="text-xs text-stone -mt-2">
                List {JOIN_MIN_PROJECTS} to {JOIN_MAX_PROJECTS} projects you have done. For each one add at
                least {JOIN_MIN_PHOTOS_PER_PROJECT} photos (up to {JOIN_MAX_PHOTOS_PER_PROJECT}): one of the
                finished work and one taken during the work is ideal. Add the developer you did it for,
                unless they asked not to be named.
              </p>

              {projects.map((project, index) => (
                <div key={index} className="border border-line rounded-md p-4 flex flex-col gap-3 bg-paper">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Project {index + 1}</span>
                    {projects.length > JOIN_MIN_PROJECTS && (
                      <button type="button" onClick={() => setProjects((p) => p.filter((_, i) => i !== index))}
                        className="text-xs font-medium text-danger">
                        Remove
                      </button>
                    )}
                  </div>
                  <input type="text" maxLength={200} value={project.name} aria-label={`Project ${index + 1} name`}
                    onChange={(e) => updateProject(index, 'name', e.target.value)}
                    placeholder="Project name" className={inputClass} />
                  <input type="text" maxLength={200} value={project.developerName}
                    aria-label={`Project ${index + 1} developer`}
                    onChange={(e) => updateProject(index, 'developerName', e.target.value)}
                    placeholder="Developer you worked with" className={inputClass} />
                  <div>
                    <label htmlFor={`join-project-area-${index}`} className="block text-xs text-stone mb-1">
                      Where is it?
                    </label>
                    <AreaPicker id={`join-project-area-${index}`} value={project.area}
                      onChange={(v) => updateProject(index, 'area', v)} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor={`join-project-sqft-${index}`} className="block text-xs text-stone mb-1">
                      Built-up area in sq ft (a rough figure is fine)
                    </label>
                    <input id={`join-project-sqft-${index}`} type="text" inputMode="numeric" maxLength={12}
                      value={project.builtUpArea} placeholder="e.g. 45000"
                      onChange={(e) => updateProject(index, 'builtUpArea', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <p id={`join-project-visit-${index}`} className="block text-xs text-stone mb-1">
                      Can you arrange a site visit here for a developer?
                    </p>
                    <YesNo value={project.siteVisitPossible} labelledBy={`join-project-visit-${index}`}
                      onChange={(v) => updateProject(index, 'siteVisitPossible', v)} />
                  </div>

                  {project.imageUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {project.imageUrls.map((url) => (
                        <div key={url} className="relative">
                          <Image src={url} alt="" width={72} height={72}
                            className="w-[72px] h-[72px] rounded-md object-cover border border-line" />
                          <button type="button" onClick={() => removePhoto(index, url)} aria-label="Remove photo"
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-ink text-paper text-xs leading-none">
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className={`text-xs ${project.imageUrls.length >= JOIN_MIN_PHOTOS_PER_PROJECT ? 'text-sage' : 'text-stone'}`}>
                    {project.imageUrls.length} of {JOIN_MAX_PHOTOS_PER_PROJECT} photos
                    {project.imageUrls.length < JOIN_MIN_PHOTOS_PER_PROJECT && `, at least ${JOIN_MIN_PHOTOS_PER_PROJECT} needed`}
                  </p>
                  {project.imageUrls.length < JOIN_MAX_PHOTOS_PER_PROJECT && (
                    <ImageUpload
                      key={project.imageUrls.length}
                      label={project.imageUrls.length === 0 ? 'Add photo' : 'Add another photo'}
                      value={null}
                      onChange={(url) => url && addPhoto(index, url)}
                      onUploadStateChange={onUploadState}
                      uploadUrl={UPLOAD_URL} shrinkLargePhotos
                    />
                  )}
                </div>
              ))}

              {projects.length < JOIN_MAX_PROJECTS && (
                <button type="button" onClick={() => setProjects((p) => [...p, emptyProject()])}
                  className="self-start text-sm font-medium border border-line rounded-full px-4 py-2 hover:border-ink">
                  + Add another project
                </button>
              )}
            </fieldset>

            <label className="flex items-start gap-2.5 text-sm pt-6 border-t border-line">
              <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5" />
              <span>
                I agree that (kalm) may use these details and photos to set up my business listing,
                and may contact me about it. See our{' '}
                <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
              </span>
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button type="submit" disabled={submitting || uploading > 0}
              className="bg-ink text-paper font-medium text-sm py-3 rounded-full hover:bg-stone transition-colors disabled:opacity-60">
              {uploading > 0 ? 'Waiting for photos to upload…' : submitting ? 'Sending…' : 'Send my details'}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
