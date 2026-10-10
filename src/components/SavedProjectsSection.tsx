'use client';

// "Your projects" on the developer dashboard: add, edit and delete saved
// projects (name, work needed, location, optional budget, details). The
// quote forms offer these under "Use a saved project" so the developer
// never retypes the same project. See src/lib/saved-projects.ts.

import { useEffect, useState } from 'react';
import { ALL_TRADES } from '@/lib/trade-types';
import { formatRupees } from '@/lib/budget';
import type { SavedProjectClient } from '@/lib/saved-projects';
import { BudgetInput, inputClass, labelClass } from '@/components/QuoteFormParts';

type Draft = { name: string; workNeeded: string; location: string; budgetDigits: string; details: string };

const EMPTY_DRAFT: Draft = { name: '', workNeeded: '', location: '', budgetDigits: '', details: '' };

function draftFrom(p: SavedProjectClient): Draft {
  return {
    name: p.name,
    workNeeded: p.workNeeded ?? '',
    location: p.location,
    budgetDigits: p.budgetAmount ? String(p.budgetAmount) : '',
    details: p.details,
  };
}

export default function SavedProjectsSection() {
  const [projects, setProjects] = useState<SavedProjectClient[] | null>(null);
  // null = no form open; 'new' = adding; otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/developers/projects')
      .then((r) => (r.ok ? r.json() : []))
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  function open(id: string | null, p?: SavedProjectClient) {
    setEditing(id);
    setDraft(p ? draftFrom(p) : EMPTY_DRAFT);
    setError('');
    setConfirmDelete(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError('');
    const body = {
      name: draft.name,
      workNeeded: draft.workNeeded || null,
      location: draft.location,
      budgetAmount: draft.budgetDigits ? Number(draft.budgetDigits) : null,
      details: draft.details,
    };
    try {
      const res = await fetch(editing === 'new' ? '/api/developers/projects' : `/api/developers/projects/${editing}`, {
        method: editing === 'new' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? 'Could not save. Please try again.');
        return;
      }
      setProjects((prev) => [data as SavedProjectClient, ...(prev ?? []).filter((p) => p.id !== data.id)]);
      setEditing(null);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/developers/projects/${id}`, { method: 'DELETE' }).catch(() => null);
    if (res?.ok) {
      setProjects((prev) => (prev ?? []).filter((p) => p.id !== id));
      setConfirmDelete(null);
    }
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const form = (
    <form onSubmit={save} className="border border-ink rounded-[6px] p-4 bg-paper flex flex-col gap-3.5 mb-3">
      <div>
        <label htmlFor="sp-name" className={labelClass}>Project name</label>
        <input
          id="sp-name"
          required
          maxLength={80}
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Andheri tower"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="sp-work" className={labelClass}>
          Work needed <span className="font-normal">(optional)</span>
        </label>
        <select id="sp-work" value={draft.workNeeded} onChange={(e) => set('workNeeded', e.target.value)} className={inputClass}>
          <option value="">Not set</option>
          {ALL_TRADES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="sp-location" className={labelClass}>Location</label>
        <input
          id="sp-location"
          required
          value={draft.location}
          onChange={(e) => set('location', e.target.value)}
          placeholder="Area, City"
          className={inputClass}
        />
      </div>
      <BudgetInput id="sp-budget" digits={draft.budgetDigits} onChange={(d) => set('budgetDigits', d)} />
      <div>
        <label htmlFor="sp-details" className={labelClass}>Project details</label>
        <textarea
          id="sp-details"
          required
          rows={3}
          value={draft.details}
          onChange={(e) => set('details', e.target.value)}
          placeholder="Timeline, scope, floors, size..."
          className={`${inputClass} resize-y`}
        />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="text-sm font-medium px-4 py-2 rounded-full bg-ink text-paper disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save project'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="text-sm px-4 py-2 rounded-full border border-line hover:border-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h2 className="font-display font-light text-xl">Saved details</h2>
        {editing !== 'new' && (
          <button
            type="button"
            onClick={() => open('new')}
            className="text-xs font-medium px-4 py-2 rounded-full border border-line hover:border-ink"
          >
            + Save details
          </button>
        )}
      </div>
      <p className="text-sm text-stone mb-4">
        Save a project&apos;s details once, then pick it on any quote form instead of typing them again.
      </p>

      {editing === 'new' && form}

      {projects !== null && projects.length === 0 && editing !== 'new' && (
        <p className="text-sm text-stone">Nothing saved yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {(projects ?? []).map((p) =>
          editing === p.id ? (
            <div key={p.id}>{form}</div>
          ) : (
            <div key={p.id} className="border border-line rounded-[6px] p-4 bg-paper">
              <div className="flex justify-between items-start flex-wrap gap-2 mb-1">
                <p className="font-medium text-sm">{p.name}</p>
                <div className="flex gap-3 text-xs">
                  <button type="button" onClick={() => open(p.id, p)} className="text-stone hover:text-ink">
                    Edit
                  </button>
                  {confirmDelete === p.id ? (
                    <>
                      <button type="button" onClick={() => remove(p.id)} className="text-danger font-medium">
                        Yes, delete
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="text-stone hover:text-ink">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(p.id)} className="text-stone hover:text-danger">
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-stone mb-1">
                {[p.workNeeded, p.location, p.budgetAmount ? formatRupees(p.budgetAmount) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="text-xs text-stone line-clamp-2">{p.details}</p>
            </div>
          )
        )}
      </div>
    </section>
  );
}
