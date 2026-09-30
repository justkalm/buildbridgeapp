// src/components/TradeTypePicker.tsx
//
// Two-step picker for Contractor.tradeTypes (KALM-167), constrained to the
// list in src/lib/trade-types.ts. Used everywhere trades are set: contractor
// signup, the contractor's profile edit and admin's add-contractor form, so
// all three pick trades the same way.
//
// Step 1: choose a trade from a dropdown (a native select, so the 20 trades
// stay out of the way on a phone; the owner found 20 buttons too cluttered).
// Step 2: that trade opens as one box of specialities to tick. "Add another
// trade" repeats it. If a speciality is missing, "Something else?" lets the
// contractor type their own (stored as an Other|<trade>|<text> value, see
// trade-types.ts), so the list can grow from what contractors actually do.
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
  // Trades whose "Something else?" box is showing.
  const [otherOpen, setOtherOpen] = useState<Set<string>>(new Set());
  const otherCount = selected.filter(isOtherSpeciality).length;

  // Values that aren't in the current list (old data not yet moved
  // across). Shown so they can be removed; the server won't save them.
  const unlisted = selected.filter((v) => tradeOf(v) === null);

  function openTrade(trade: string) {
    if (!trade) return;
    setOpenTrades((prev) => new Set(prev).add(trade));
  }

  function removeTrade(trade: string) {
    setOpenTrades((prev) => {
      const next = new Set(prev);
      next.delete(trade);
      return next;
    });
    onChange(selected.filter((v) => tradeOf(v) !== trade));
  }

  function toggleValue(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  function addOther(trade: string) {
    const text = (otherDrafts[trade] ?? '').trim();
    if (text.length < 2) return;
    // May come back as a listed speciality (typed "sprinklers"), possibly
    // under a different trade (typed "CCTV" under Fire): open that trade
    // so the tick is visible where it belongs.
    const value = makeOtherSpeciality(trade, text);
    const home = tradeOf(value);
    if (home) setOpenTrades((prev) => new Set(prev).add(home));
    if (!selected.some((v) => v.toLowerCase() === value.toLowerCase())) onChange([...selected, value]);
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

      {TRADES.filter(({ trade }) => openTrades.has(trade)).map(({ trade, specialities }) => {
        const mine = selected.filter((v) => tradeOf(v) === trade);
        const others = mine.filter(isOtherSpeciality);
        const draft = otherDrafts[trade] ?? '';
        const showOther = otherOpen.has(trade);
        return (
          <div key={trade} className="border border-line rounded-[6px] p-3 mb-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-medium text-ink">{trade}</p>
              <button
                type="button"
                onClick={() => removeTrade(trade)}
                className="text-xs text-stone underline underline-offset-2 hover:text-danger"
                aria-label={`Remove ${trade}`}
              >
                Remove
              </button>
            </div>
            <p className="text-xs text-stone mb-2">Tick what you do:</p>
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
              <p className="text-[11px] text-danger mt-2">Tick at least one, or remove this trade.</p>
            )}
            {otherCount < MAX_OTHER_PER_CONTRACTOR &&
              (showOther ? (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    autoFocus
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
                    placeholder="Type what you do"
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
              ) : (
                <button
                  type="button"
                  onClick={() => setOtherOpen((prev) => new Set(prev).add(trade))}
                  className="text-xs text-stone underline underline-offset-2 hover:text-ink mt-2"
                >
                  Something else? Tell us
                </button>
              ))}
          </div>
        );
      })}

      {openTrades.size < TRADES.length && (
        <select
          value=""
          onChange={(e) => openTrade(e.target.value)}
          aria-label={openTrades.size === 0 ? 'Choose your trade' : 'Add another trade'}
          className="w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
        >
          <option value="">{openTrades.size === 0 ? 'Choose your trade' : '+ Add another trade'}</option>
          {TRADES.filter(({ trade }) => !openTrades.has(trade)).map(({ trade }) => (
            <option key={trade} value={trade}>
              {trade}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
