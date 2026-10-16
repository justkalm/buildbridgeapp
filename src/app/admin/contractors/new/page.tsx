// src/app/admin/contractors/new/page.tsx
//
// Opened with ?from=<id> from /admin/applications ("Add as contractor"),
// the form starts filled in from that contractor's /join form, and once the
// listing is saved the form is marked Added. Everything stays editable, and
// nothing is saved until admin presses the button, same as a blank form.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ImageUpload from '@/components/ImageUpload';
import AdminTabs from '@/components/AdminTabs';
import TradeTypePicker from '@/components/TradeTypePicker';
import { MUMBAI_CITY } from '@/lib/mumbai-areas';
import AreaPicker from '@/components/AreaPicker';
import { MAX_INSURANCE_COVER_LAKH, MAX_TEAM_SIZE, teamSizeRangeError } from '@/lib/project-validation';

type ProjectDraft = {
  title: string;
  developerName: string;
  squareFeet: string;
  elevationFloors: string;
  committedDurationMonths: string;
  actualDurationMonths: string;
  projectType: string;
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
  imageUrls: [],
});

export default function NewContractorPage() {
  const [name, setName] = useState('');
  const city = MUMBAI_CITY; // Mumbai only for now (src/lib/mumbai-areas.ts)
  const [area, setArea] = useState('');
  const [tradeTypes, setTradeTypes] = useState<string[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
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
  // The /join form this listing is being made from, if any.
  const [fromApplication, setFromApplication] = useState<{
    id: string;
    businessName: string;
    gstNumber: string | null;
    hasInsurance: boolean;
  } | null>(null);

  // True while a ?from= form is loading, so the prefill can't overwrite
  // something admin has already started typing.
  const [prefilling, setPrefilling] = useState(false);

  useEffect(() => {
    const fromId = new URLSearchParams(window.location.search).get('from');
    if (!fromId) return;
    // 0ms timer rather than an inline call: setting state synchronously in
    // an effect is a lint error in this repo (react-hooks/set-state-in-effect).
    const start = setTimeout(() => setPrefilling(true), 0);
    fetch(`/api/admin/applications/${encodeURIComponent(fromId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(
        (a: {
          id: string;
          businessName: string;
          phone: string;
          email: string;
          area: string;
          bio: string | null;
          logoUrl: string | null;
          tradeTypes: string[];
          gstNumber: string | null;
          licenceNumber: string | null;
          hasInsurance: boolean;
          projects: { name: string; developerName?: string; builtUpAreaSqft?: number; imageUrls: string[] }[];
        }) => {
          setName(a.businessName);
          setPhone(a.phone);
          setEmail(a.email);
          setArea(a.area);
          setBio(a.bio ?? '');
          setLogoUrl(a.logoUrl);
          setTradeTypes(a.tradeTypes);
          setPickerKey((k) => k + 1); // the picker reads `selected` only when it mounts
          // GST registered stays unticked: the number they gave is only a
          // claim until admin checks it on the GST portal (see the banner).
          setLicenseNumber(a.licenceNumber ?? '');
          setProjects(
            a.projects.map((p) => ({
              ...emptyProject(),
              title: p.name,
              developerName: p.developerName ?? '',
              squareFeet: p.builtUpAreaSqft ? String(p.builtUpAreaSqft) : '',
              imageUrls: p.imageUrls,
            }))
          );
          setFromApplication({ id: a.id, businessName: a.businessName, gstNumber: a.gstNumber, hasInsurance: a.hasInsurance });
        }
      )
      .catch(() => setError('Could not load that join form. Your admin session may have expired.'))
      .finally(() => {
        clearTimeout(start);
        setPrefilling(false);
      });
  }, []);


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

    // TradeTypePicker has no native HTML `required` the way the old text
    // input did — it's a button-based multi-select, not a form control
    // the browser validates on its own. Check explicitly instead.
    if (tradeTypes.length === 0) {
      setError('Pick at least one trade and speciality');
      return;
    }

    // Same rules as the API (src/lib/project-validation.ts), checked before
    // submit so the admin sees the message immediately.
    const rangeError = teamSizeRangeError(
      teamSizeMin ? Number(teamSizeMin) : undefined,
      teamSizeMax ? Number(teamSizeMax) : undefined
    );
    if (rangeError) {
      setError(rangeError);
      return;
    }
    if (insuranceCoverLakh && Number(insuranceCoverLakh) > MAX_INSURANCE_COVER_LAKH) {
      setError(
        `Insurance cover can't be more than ${MAX_INSURANCE_COVER_LAKH.toLocaleString('en-IN')} lakh (₹10,000 crore). Check for extra zeros.`
      );
      return;
    }

    setSubmitting(true);

    const payload = {
      name,
      city,
      area,
      tradeTypes,
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

      let addedNote = '';
      if (fromApplication) {
        const marked = await fetch(`/api/admin/applications/${fromApplication.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ADDED' }),
        }).then((r) => r.ok, () => false);
        addedNote = marked
          ? ' Its join form is marked Added.'
          : ' Could not mark its join form as Added: do that on the Join forms page.';
        setFromApplication(null);
        window.history.replaceState(null, '', '/admin/contractors/new');
      }
      setSuccess(`Added ${data.name}.${addedNote} You can add another below.`);
      setName('');
      setArea('');
      setTradeTypes([]);
      setPickerKey((k) => k + 1);
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
        {/*
          active="contractors" — this page is reached from the Contractors
          tab (via the "New Contractor" card on /admin, or a link from the
          Contractors list itself), so highlighting that tab here keeps
          the "where am I" model consistent even though this specific URL
          isn't one of the three top-level tab destinations.
        */}
        <AdminTabs active="contractors" />
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display font-light text-2xl">Add a Contractor</h1>
          <Link href="/browse" className="text-sm text-stone hover:text-ink">
            View live site →
          </Link>
        </div>
        <p className="text-stone text-sm mb-8">
          Only set status to Verified once the documents, GSTIN and a direct conversation are done. A licence number is optional.
        </p>

        {fromApplication && (
          <div className="bg-white border border-line text-sm rounded-md p-3.5 mb-5">
            Filled in from the join form of <span className="font-medium">{fromApplication.businessName}</span>.
            Check every field before saving.
            {fromApplication.gstNumber && (
              <> GST number they gave, for the GSTIN check: <span className="font-medium">{fromApplication.gstNumber}</span>.</>
            )}
            {fromApplication.hasInsurance
              ? ' They say they have insurance: ask for the cover amount before filling it in.'
              : ' They say they have no insurance.'}
            {' '}Each project&apos;s location and site-visit answer are on the Join forms page: listings have no place for them yet.
          </div>
        )}
        {success && (
          <div className="bg-sage-soft border border-sage/25 text-sage text-sm rounded-md p-3.5 mb-5">
            {success}
          </div>
        )}
        {error && (
          <div className="bg-danger-soft border border-danger text-danger text-sm rounded-md p-3.5 mb-5">
            {error}
          </div>
        )}

        {prefilling ? (
          <p className="text-sm text-stone">Loading the join form…</p>
        ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 bg-paper border border-line rounded-md p-6">
          <Field label="Business name">
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>

          <ImageUpload label="Logo (optional)" value={logoUrl} onChange={setLogoUrl} />

          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <input value={MUMBAI_CITY} readOnly className={`${inputCls} bg-paper-dim text-stone`} />
            </Field>
            <Field label="Area / neighborhood">
              <AreaPicker value={area} onChange={setArea} className={inputCls} />
            </Field>
          </div>

          <Field label="Trade & specialities">
            {/* Keyed so "add another" also closes the trades opened for the
                previous contractor, not just clears their ticks. */}
            <TradeTypePicker key={pickerKey} selected={tradeTypes} onChange={setTradeTypes} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="License number (optional)">
              <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Verification status">
              <select
                value={verificationStatus}
                onChange={(e) => setVerificationStatus(e.target.value as 'PENDING' | 'VERIFIED')}
                className={inputCls}
              >
                <option value="PENDING">Pending: not yet checked</option>
                <option value="VERIFIED">Verified: documents, GSTIN and contact checked</option>
              </select>
            </Field>
          </div>

          <Field label="Tier (free during trial: this is a manual override, not billing)">
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
              <input type="number" min="0" max={MAX_TEAM_SIZE} value={teamSizeMin} onChange={(e) => setTeamSizeMin(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Team size (max)">
              <input type="number" min="0" max={MAX_TEAM_SIZE} value={teamSizeMax} onChange={(e) => setTeamSizeMax(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <Field label="Insurance cover (₹ lakh)">
              <input type="number" min="0" max={MAX_INSURANCE_COVER_LAKH} value={insuranceCoverLakh} onChange={(e) => setInsuranceCoverLakh(e.target.value)} className={inputCls} />
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
            <Field label="Email (required: this becomes their dashboard login)">
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
                No projects added. It&apos;s fine to leave this empty and add projects later. An empty
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
                    <button type="button" onClick={() => removeProject(i)} className="text-xs text-danger px-1">
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
                  </div>

                  <div className="flex flex-wrap gap-3 items-end">
                    {p.imageUrls.map((url) => (
                      <div key={url} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element -- external Blob URL */}
                        <img src={url} alt="" className="w-16 h-16 rounded-md object-cover border border-line" />
                        <button
                          type="button"
                          onClick={() => removeProjectImage(i, url)}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-danger text-white text-xs leading-5 text-center"
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
        )}
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
