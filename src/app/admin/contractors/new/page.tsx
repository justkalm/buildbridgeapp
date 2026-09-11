// src/app/admin/contractors/new/page.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import ImageUpload from '@/components/ImageUpload';

type ProjectDraft = {
  title: string;
  developerName: string;
  squareFeet: string;
  elevationFloors: string;
  committedDurationMonths: string;
  actualDurationMonths: string;
  projectType: string;
  completedYear: string;
  imageUrls: string[];
};

const emptyProject = (): ProjectDraft => ({
  title: '',
  developerName: '',
  squareFeet: '',
  elevationFloors: '',
  committedDurationMonths: '',
  actualDurationMonths: '',
  projectType: '',
  completedYear: '',
  imageUrls: [],
});

export default function NewContractorPage() {
  const [name, setName] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [area, setArea] = useState('');
  const [tradeTypesInput, setTradeTypesInput] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'PENDING' | 'VERIFIED'>('PENDING');
  const [tier, setTier] = useState<'LISTED' | 'PLUS' | 'PRO'>('LISTED');
  const [yearsInBusiness, setYearsInBusiness] = useState('');
  const [teamSizeMin, setTeamSizeMin] = useState('');
  const [teamSizeMax, setTeamSizeMax] = useState('');
  const [gstRegistered, setGstRegistered] = useState(false);
  const [insuranceCoverLakh, setInsuranceCoverLakh] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectDraft[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function addProjectRow() {
    setProjects((p) => [...p, emptyProject()]);
  }

  function updateProject(index: number, field: keyof Omit<ProjectDraft, 'imageUrls'>, value: string) {
    setProjects((p) => p.map((proj, i) => (i === index ? { ...proj, [field]: value } : proj)));
  }

  function addProjectImage(index: number, url: string) {
    setProjects((p) => p.map((proj, i) => (i === index ? { ...proj, imageUrls: [...proj.imageUrls, url] } : proj)));
  }

  function removeProjectImage(index: number, url: string) {
    setProjects((p) =>
      p.map((proj, i) => (i === index ? { ...proj, imageUrls: proj.imageUrls.filter((u) => u !== url) } : proj))
    );
  }

  function removeProject(index: number) {
    setProjects((p) => p.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const payload = {
      name,
      city,
      area,
      tradeTypes: tradeTypesInput.split(',').map((t) => t.trim()).filter(Boolean),
      licenseNumber,
      verificationStatus,
      tier,
      yearsInBusiness: yearsInBusiness ? Number(yearsInBusiness) : undefined,
      teamSizeMin: teamSizeMin ? Number(teamSizeMin) : undefined,
      teamSizeMax: teamSizeMax ? Number(teamSizeMax) : undefined,
      gstRegistered,
      insuranceCoverLakh: insuranceCoverLakh ? Number(insuranceCoverLakh) : undefined,
      phone,
      email,
      bio: bio || undefined,
      logoUrl: logoUrl || undefined,
      projects: projects
        .filter((p) => p.title.trim())
        .map((p) => ({
          title: p.title,
          developerName: p.developerName || undefined,
          squareFeet: p.squareFeet ? Number(p.squareFeet) : undefined,
          elevationFloors: p.elevationFloors ? Number(p.elevationFloors) : undefined,
          committedDurationMonths: p.committedDurationMonths ? Number(p.committedDurationMonths) : undefined,
          actualDurationMonths: p.actualDurationMonths ? Number(p.actualDurationMonths) : undefined,
          projectType: p.projectType || undefined,
          completedYear: p.completedYear ? Number(p.completedYear) : undefined,
          imageUrls: p.imageUrls,
        })),
    };

    try {
      const res = await fetch('/api/admin/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setError('Your admin session has expired. Please log in again.');
        } else {
          setError(data.error ?? 'Something went wrong');
        }
        setSubmitting(false);
        return;
      }

      setSuccess(`Added ${data.name}. You can add another below.`);
      setName('');
      setArea('');
      setTradeTypesInput('');
      setLicenseNumber('');
      setVerificationStatus('PENDING');
      setYearsInBusiness('');
      setTeamSizeMin('');
      setTeamSizeMax('');
      setGstRegistered(false);
      setInsuranceCoverLakh('');
      setPhone('');
      setEmail('');
      setBio('');
      setLogoUrl(null);
      setProjects([]);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper-dim py-10 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display font-light text-2xl">Add a Contractor</h1>
          <Link href="/browse" className="text-sm text-stone hover:text-ink">
            View live site →
          </Link>
        </div>
        <p className="text-stone text-sm mb-8">
          Only set status to Verified once you&apos;ve confirmed the license number.
        </p>

        {success && (
          <div className="bg-sage-soft border border-sage/25 text-sage text-sm rounded-md p-3.5 mb-5">
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3.5 mb-5">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 bg-paper border border-line rounded-md p-6">
          <Field label="Business name">
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>

          <ImageUpload label="Logo (optional)" value={logoUrl} onChange={setLogoUrl} />

          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <input required value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Area / neighborhood">
              <input required value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Thane" className={inputCls} />
            </Field>
          </div>

          <Field label="Trade types (comma-separated)">
            <input
              required
              value={tradeTypesInput}
              onChange={(e) => setTradeTypesInput(e.target.value)}
              placeholder="RCC & Structural, Waterproofing"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="License number">
              <input required value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Verification status">
              <select
                value={verificationStatus}
                onChange={(e) => setVerificationStatus(e.target.value as 'PENDING' | 'VERIFIED')}
                className={inputCls}
              >
                <option value="PENDING">Pending — not yet checked</option>
                <option value="VERIFIED">Verified — license confirmed</option>
              </select>
            </Field>
          </div>

          <Field label="Tier (free during trial — this is a manual override, not billing)">
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as 'LISTED' | 'PLUS' | 'PRO')}
              className={inputCls}
            >
              <option value="LISTED">Listed (default, free)</option>
              <option value="PLUS">Plus</option>
              <option value="PRO">Pro</option>
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Years in business">
              <input type="number" min="0" value={yearsInBusiness} onChange={(e) => setYearsInBusiness(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Team size (min)">
              <input type="number" min="0" value={teamSizeMin} onChange={(e) => setTeamSizeMin(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Team size (max)">
              <input type="number" min="0" value={teamSizeMax} onChange={(e) => setTeamSizeMax(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <Field label="Insurance cover (₹ lakh)">
              <input type="number" min="0" value={insuranceCoverLakh} onChange={(e) => setInsuranceCoverLakh(e.target.value)} className={inputCls} />
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium pb-2.5">
              <input type="checkbox" checked={gstRegistered} onChange={(e) => setGstRegistered(e.target.checked)} />
              GST registered
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone (used for quote notifications)">
              <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX" className={inputCls} />
            </Field>
            <Field label="Email (required — this becomes their dashboard login)">
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Bio (optional)">
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className={inputCls} />
          </Field>

          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-sm">Completed projects (optional)</h3>
              <button type="button" onClick={addProjectRow} className="text-xs font-medium text-ink">
                + Add project
              </button>
            </div>
            {projects.length === 0 && (
              <p className="text-xs text-stone">
                No projects added. It&apos;s fine to leave this empty and add projects later — an empty
                list is more honest than one made up.
              </p>
            )}
            <div className="flex flex-col gap-3">
              {projects.map((p, i) => (
                <div key={i} className="border border-line rounded-md p-3.5 bg-paper-dim">
                  <div className="flex justify-between items-start mb-2.5">
                    <input
                      value={p.title}
                      onChange={(e) => updateProject(i, 'title', e.target.value)}
                      placeholder="Project title"
                      className={`${inputCls} flex-1 mr-2`}
                    />
                    <button type="button" onClick={() => removeProject(i)} className="text-xs text-red-600 px-1">
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 mb-3">
                    <input
                      value={p.developerName}
                      onChange={(e) => updateProject(i, 'developerName', e.target.value)}
                      placeholder="Developer name (optional)"
                      className={inputCls}
                    />
                    <input
                      value={p.projectType}
                      onChange={(e) => updateProject(i, 'projectType', e.target.value)}
                      placeholder="e.g. Residential, 12 floors"
                      className={inputCls}
                    />
                    <input
                      type="number"
                      value={p.squareFeet}
                      onChange={(e) => updateProject(i, 'squareFeet', e.target.value)}
                      placeholder="Square feet"
                      className={inputCls}
                    />
                    <input
                      type="number"
                      value={p.elevationFloors}
                      onChange={(e) => updateProject(i, 'elevationFloors', e.target.value)}
                      placeholder="Floors (e.g. 18 for G+18)"
                      className={inputCls}
                    />
                    <input
                      type="number"
                      value={p.committedDurationMonths}
                      onChange={(e) => updateProject(i, 'committedDurationMonths', e.target.value)}
                      placeholder="Committed duration (months)"
                      className={inputCls}
                    />
                    <input
                      type="number"
                      value={p.actualDurationMonths}
                      onChange={(e) => updateProject(i, 'actualDurationMonths', e.target.value)}
                      placeholder="Actual duration (months)"
                      className={inputCls}
                    />
                    <input
                      type="number"
                      value={p.completedYear}
                      onChange={(e) => updateProject(i, 'completedYear', e.target.value)}
                      placeholder="Contract value (₹ lakh)"
                      className={inputCls}
                    />
                    <input
                      type="number"
                      value={p.completedYear}
                      onChange={(e) => updateProject(i, 'completedYear', e.target.value)}
                      placeholder="Year completed"
                      className={inputCls}
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 items-end">
                    {p.imageUrls.map((url) => (
                      <div key={url} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element -- external Blob URL */}
                        <img src={url} alt="" className="w-16 h-16 rounded-md object-cover border border-line" />
                        <button
                          type="button"
                          onClick={() => removeProjectImage(i, url)}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white text-xs leading-5 text-center"
                          aria-label="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <div className="w-40">
                      <ImageUpload
                        label={p.imageUrls.length === 0 ? 'Add photo' : 'Add another'}
                        value={null}
                        onChange={(url) => url && addProjectImage(i, url)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 bg-ink text-paper font-medium text-sm py-3 rounded-full hover:bg-stone transition-colors disabled:opacity-60"
          >
            {submitting ? 'Adding…' : 'Add Contractor'}
          </button>
        </form>
      </div>
    </main>
  );
}

const inputCls = 'w-full px-3 py-2.5 border border-line rounded-[4px] text-[13.5px] bg-paper focus:outline-none focus:ring-2 focus:ring-ink';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone mb-1.5">{label}</label>
      {children}
    </div>
  );
}
