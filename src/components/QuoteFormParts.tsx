'use client';

// The parts of the quote form on a contractor's profile, kept apart from
// that (long) page. BudgetInput is also used by the dashboard's saved
// project form.
//
//   - useQuoteFormData(): loads the developer's saved projects and their
//     phone number (pre-filled, so nobody retypes it).
//   - <SavedProjectPicker>: "Use a saved project" dropdown; picking one
//     fills the form.
//   - <QuoteDetailsFields>: location, optional budget in Rs., details,
//     phone, and the "Save these details as a project" tick box.
//
// The parent owns the values (QuoteDetails) so it can send them; these
// components only display and edit them.

import { useEffect, useState } from 'react';
import { MAX_BUDGET_RUPEES, digitsOnly, rupeesInWords } from '@/lib/budget';
import type { SavedProjectClient } from '@/lib/saved-projects';

export type QuoteDetails = {
  location: string;
  budgetDigits: string; // digits only; '' = no budget given
  details: string;
  contactPhone: string;
  saveProject: boolean;
  projectName: string;
};

export const EMPTY_QUOTE_DETAILS: QuoteDetails = {
  location: '',
  budgetDigits: '',
  details: '',
  contactPhone: '',
  saveProject: false,
  projectName: '',
};

/** The details part of the quote request body. */
export function quoteDetailsBody(d: QuoteDetails) {
  return {
    location: d.location,
    budgetAmount: d.budgetDigits ? Number(d.budgetDigits) : null,
    details: d.details,
    contactPhone: d.contactPhone,
    saveAsProject: d.saveProject && d.projectName.trim() ? { name: d.projectName.trim() } : null,
  };
}

/**
 * Loads saved projects and the developer's phone, only when `enabled`
 * (a signed-in developer). Calls onPhone once with the account phone so
 * the form can pre-fill it.
 */
export function useQuoteFormData(enabled: boolean, onPhone: (phone: string) => void) {
  const [projects, setProjects] = useState<SavedProjectClient[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch('/api/developers/projects')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: SavedProjectClient[]) => {
        if (!cancelled) setProjects(rows);
      })
      .catch(() => {});
    fetch('/api/developers/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((me: { phone?: string | null } | null) => {
        if (!cancelled && me?.phone) onPhone(me.phone);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // onPhone is a setter wrapper from the parent; run once per sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { projects, setProjects };
}

/** Fills the details from a saved project, keeping the phone as it is. */
export function detailsFromProject(prev: QuoteDetails, p: SavedProjectClient): QuoteDetails {
  return {
    ...prev,
    location: p.location,
    budgetDigits: p.budgetAmount ? String(p.budgetAmount) : '',
    details: p.details,
    // Already saved, so there's nothing to save again.
    saveProject: false,
    projectName: '',
  };
}

export const inputClass = 'w-full px-3 py-2.5 border border-line rounded-[4px] text-[13.5px] bg-paper';
export const labelClass = 'block text-xs font-medium text-stone mb-1.5';

export function SavedProjectPicker({
  projects,
  onPick,
}: {
  projects: SavedProjectClient[];
  onPick: (project: SavedProjectClient) => void;
}) {
  const [selected, setSelected] = useState('');
  if (projects.length === 0) return null;
  return (
    <div>
      <label htmlFor="quote-saved-project" className={labelClass}>
        Use a saved project
      </label>
      <select
        id="quote-saved-project"
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          const p = projects.find((x) => x.id === e.target.value);
          if (p) onPick(p);
        }}
        className={inputClass}
      >
        <option value="">Choose a project to fill the form</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Optional budget in rupees: "Rs." fixed in front, digits grouped the
 * Indian way as you type (12,50,000), and the amount in lakh/crore words
 * underneath so nobody miscounts zeros. Also used by the saved-project
 * form on the dashboard.
 */
export function BudgetInput({
  id,
  digits,
  onChange,
}: {
  id: string;
  digits: string;
  onChange: (digits: string) => void;
}) {
  const words = digits ? rupeesInWords(Number(digits)) : null;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        Estimated budget <span className="font-normal">(optional)</span>
      </label>
      <div className="flex items-center border border-line rounded-[4px] bg-paper focus-within:border-ink">
        <span className="pl-3 pr-1.5 text-[13.5px] text-stone select-none" aria-hidden="true">Rs.</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-describedby={`${id}-words`}
          value={digits ? Number(digits).toLocaleString('en-IN') : ''}
          onChange={(e) => {
            const next = digitsOnly(e.target.value);
            if (!next || Number(next) <= MAX_BUDGET_RUPEES) onChange(next);
          }}
          placeholder="e.g. 25,00,000"
          className="w-full pr-3 py-2.5 text-[13.5px] bg-transparent focus:outline-none"
        />
      </div>
      <p id={`${id}-words`} className="text-[11.5px] text-stone mt-1 min-h-[1em]">
        {digits ? words ?? '' : 'Leave blank if you are not sure yet.'}
      </p>
    </div>
  );
}

export function QuoteDetailsFields({
  value,
  onChange,
}: {
  value: QuoteDetails;
  onChange: (next: QuoteDetails) => void;
}) {
  const set = <K extends keyof QuoteDetails>(key: K, v: QuoteDetails[K]) => onChange({ ...value, [key]: v });

  return (
    <>
      <div>
        <label htmlFor="quote-location" className={labelClass}>Location</label>
        <input
          id="quote-location"
          type="text"
          required
          value={value.location}
          onChange={(e) => set('location', e.target.value)}
          placeholder="Area, City"
          className={inputClass}
        />
      </div>
      <BudgetInput id="quote-budget" digits={value.budgetDigits} onChange={(d) => set('budgetDigits', d)} />
      <div>
        <label htmlFor="quote-details" className={labelClass}>Project details</label>
        <textarea
          id="quote-details"
          required
          value={value.details}
          onChange={(e) => set('details', e.target.value)}
          placeholder="Timeline, scope..."
          rows={3}
          className={`${inputClass} resize-y`}
        />
      </div>
      <div>
        <label htmlFor="quote-phone" className={labelClass}>Phone number</label>
        <input
          id="quote-phone"
          type="tel"
          required
          value={value.contactPhone}
          onChange={(e) => set('contactPhone', e.target.value)}
          placeholder="+91 00000 00000"
          className={inputClass}
        />
      </div>
      <div>
        <label className="flex items-start gap-2 text-[13px] text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={value.saveProject}
            onChange={(e) => set('saveProject', e.target.checked)}
            className="mt-0.5"
          />
          <span>Save these details as a project, to reuse next time</span>
        </label>
        {value.saveProject && (
          <input
            type="text"
            required
            maxLength={80}
            value={value.projectName}
            onChange={(e) => set('projectName', e.target.value)}
            placeholder="Project name, e.g. Andheri tower"
            aria-label="Project name"
            className={`${inputClass} mt-2`}
          />
        )}
      </div>
    </>
  );
}
