// src/components/TradeTypePicker.tsx
//
// Two-step picker for Contractor.tradeTypes (KALM-167), constrained to the
// list in src/lib/trade-types.ts. Used everywhere trades are set: contractor
// signup, the contractor's profile edit and admin's add-contractor form, so
// all three pick trades the same way.
//
// Step 1: "What's your trade?" — tap one or more of the 20 trades.
// Step 2: under each chosen trade, tick the specialities you do. If one's
// missing, "Something else?" lets the contractor type their own (stored as
// an Other|<trade>|<text> value, see trade-types.ts), so the list can grow
// from what contractors actually do.
//
// A trade with a speciality already picked starts open, so an existing
// profile loads showing what's saved. Closing a trade clears the
// specialities inside it, rather than leaving them saved but hidden.

'use client';

import { useMemo, useState } from 'react';
import {
  TRADES,
  MAX_OTHER_LENGTH,
  MAX_OTHER_PER_CONTRACTOR,
  isOtherSpeciality,
  makeOtherSpeciality,
  specialityLabel,
  tradeOf,
} from '@/lib/trade-types';

type TradeTypePickerProps = {
  selected: string[];
  onChange: (next: string[]) => void;
};

export default function TradeTypePicker({ selected, onChange }: TradeTypePickerProps) {
  const initialOpen = useMemo(() => {
    const open = new Set<string>();
    for (const value of selected) {
      const trade = tradeOf(value);
      if (trade) open.add(trade);
    }
    return open;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only computed once, from the initial `selected`
  }, []);

  const [openTrades, setOpenTrades] = useState<Set<string>>(initialOpen);
  const [otherDrafts, setOtherDrafts] = useState<Record<string, string>>({});
  const otherCount = selected.filter(isOtherSpeciality).length;

  // Values that aren't in the current list (old data not yet moved
  // across). Shown so they can be removed; the server won't save them.
  const unlisted = selected.filter((v) => tradeOf(v) === null);

  function toggleTrade(trade: string) {
    setOpenTrades((prev) => {
      const next = new Set(prev);
      if (next.has(trade)) {
        next.delete(trade);
        onChange(selected.filter((v) => tradeOf(v) !== trade));
      } else {
        next.add(trade);
      }
      return next;
    });
  }

  function toggleValue(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  function addOther(trade: string) {
    const text = (otherDrafts[trade] ?? '').trim();
    if (text.length < 2) return;
    const value = makeOtherSpeciality(trade, text);
    if (!selected.includes(value)) onChange([...selected, value]);
    setOtherDrafts((prev) => ({ ...prev, [trade]: '' }));
  }

  return (
    <div>
      {unlisted.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-stone mb-1.5">
            These are from our old trade list. Remove them and pick from the new list below.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unlisted.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleValue(value)}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-danger text-danger hover:bg-danger-soft transition-colors"
              >
                {value}
                <span aria-hidden>×</span>
                <span className="sr-only">(remove)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] font-semibold text-stone uppercase tracking-wide mb-1.5">
        What&apos;s your trade? Pick all that apply
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {TRADES.map(({ trade }) => {
          const isOpen = openTrades.has(trade);
          return (
            <button
              key={trade}
              type="button"
              aria-pressed={isOpen}
              onClick={() => toggleTrade(trade)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                isOpen ? 'bg-sage-soft border-sage text-sage font-medium' : 'border-line text-stone hover:border-ink'
              }`}
            >
              {trade}
            </button>
          );
        })}
      </div>

      {openTrades.size === 0 ? (
        <p className="text-xs text-stone">Pick a trade above, then tick what you specialise in.</p>
      ) : (
        <div className="border border-line rounded-[4px] p-3 flex flex-col gap-4">
          {TRADES.filter(({ trade }) => openTrades.has(trade)).map(({ trade, specialities }) => {
            const mine = selected.filter((v) => tradeOf(v) === trade);
            const others = mine.filter(isOtherSpeciality);
            const draft = otherDrafts[trade] ?? '';
            return (
              <div key={trade}>
                <p className="text-[11px] font-semibold text-stone uppercase tracking-wide mb-1.5">
                  {trade}: what do you do?
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[...specialities, ...others].map((value) => {
                    const isSelected = selected.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleValue(value)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          isSelected ? 'bg-ink text-paper border-ink' : 'border-line text-stone hover:border-ink'
                        }`}
                      >
                        {isSelected && <span aria-hidden>✓ </span>}
                        {specialityLabel(value)}
                      </button>
                    );
                  })}
                </div>
                {mine.length === 0 && (
                  <p className="text-[11px] text-danger mt-1.5">Tick at least one, or close this trade.</p>
                )}
                {otherCount < MAX_OTHER_PER_CONTRACTOR && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={draft}
                      maxLength={MAX_OTHER_LENGTH}
                      onChange={(e) =>
                        setOtherDrafts((prev) => ({ ...prev, [trade]: e.target.value.replace(/\|/g, '') }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addOther(trade);
                        }
                      }}
                      placeholder="Something else? Type it"
                      aria-label={`Add your own ${trade} speciality`}
                      className="flex-1 min-w-0 text-xs px-3 py-1.5 border border-line rounded-full bg-paper focus:outline-none focus:border-ink"
                    />
                    <button
                      type="button"
                      onClick={() => addOther(trade)}
                      disabled={draft.trim().length < 2}
                      className="text-xs px-3 py-1.5 rounded-full border border-line text-ink hover:border-ink transition-colors disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
