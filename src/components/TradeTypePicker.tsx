// src/components/TradeTypePicker.tsx
//
// Two-step multi-select for Contractor.tradeTypes, constrained to the
// fixed list in src/lib/trade-types.ts. Used on every form that sets
// tradeTypes (admin new-contractor, contractor profile edit) — one shared
// component so the picking experience and the underlying constraint stay
// in sync everywhere.
//
// Step 1: pick which of the 8 categories apply (a contractor can span
// multiple — e.g. both Structural and MEP work). Step 2: only trades
// belonging to a SELECTED category are shown to pick from, each under its
// own labeled section. This avoids showing all 90 trades at once — you
// only see the subset relevant to categories you've already said apply,
// narrowing the choice at each step rather than one flat list/search.
//
// Selecting a trade automatically implies its category is "active" (so
// pre-filled data — e.g. loading an existing contractor's saved trades —
// correctly shows the right category sections expanded without the user
// having to re-click the category chip first). Removing the last selected
// trade in a category does NOT auto-collapse that category — the person
// explicitly chose it and might be about to pick a different trade within
// it, so collapsing out from under them would be surprising.

'use client';

import { useState, useMemo } from 'react';
import { TRADE_TYPE_CATEGORIES } from '@/lib/trade-types';

type TradeTypePickerProps = {
  selected: string[];
  onChange: (next: string[]) => void;
};

export default function TradeTypePicker({ selected, onChange }: TradeTypePickerProps) {
  // Categories that have at least one trade already selected start
  // expanded — see file header comment on why this matters for
  // pre-filled/existing data.
  const initialActive = useMemo(() => {
    const active = new Set<string>();
    for (const c of TRADE_TYPE_CATEGORIES) {
      if (c.trades.some((t) => selected.includes(t))) {
        active.add(c.category);
      }
    }
    return active;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only computed once, from initial `selected`; not meant to re-derive on every keystroke
  }, []);

  const [activeCategories, setActiveCategories] = useState<Set<string>>(initialActive);

  function toggleCategory(category: string) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
        // Deselecting a category also clears any trades already picked
        // within it — leaving them selected-but-hidden would be
        // confusing (the chip for that trade would vanish from view but
        // still count toward the contractor's profile).
        const categoryDef = TRADE_TYPE_CATEGORIES.find((c) => c.category === category);
        if (categoryDef) {
          const tradesInCategory: readonly string[] = categoryDef.trades;
          onChange(selected.filter((t) => !tradesInCategory.includes(t)));
        }
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function toggleTrade(trade: string) {
    if (selected.includes(trade)) {
      onChange(selected.filter((t) => t !== trade));
    } else {
      onChange([...selected, trade]);
    }
  }

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selected.map((trade) => (
            <button
              key={trade}
              type="button"
              onClick={() => toggleTrade(trade)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
            >
              {trade}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}

      <p className="text-[11px] font-semibold text-stone uppercase tracking-wide mb-1.5">
        Which of these apply?
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {TRADE_TYPE_CATEGORIES.map((c) => {
          const isActive = activeCategories.has(c.category);
          return (
            <button
              key={c.category}
              type="button"
              onClick={() => toggleCategory(c.category)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                isActive
                  ? 'bg-sage-soft border-sage text-sage font-medium'
                  : 'border-line text-stone hover:border-ink'
              }`}
            >
              {c.category}
            </button>
          );
        })}
      </div>

      {activeCategories.size === 0 ? (
        <p className="text-xs text-stone">Select a category above to see specific trades.</p>
      ) : (
        <div className="border border-line rounded-[4px] p-3 max-h-[280px] overflow-y-auto">
          {TRADE_TYPE_CATEGORIES.filter((c) => activeCategories.has(c.category)).map((c) => (
            <div key={c.category} className="mb-3 last:mb-0">
              <p className="text-[11px] font-semibold text-stone uppercase tracking-wide mb-1.5">
                {c.category}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {c.trades.map((trade) => {
                  const isSelected = selected.includes(trade);
                  return (
                    <button
                      key={trade}
                      type="button"
                      onClick={() => toggleTrade(trade)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        isSelected
                          ? 'bg-ink text-paper border-ink'
                          : 'border-line text-stone hover:border-ink'
                      }`}
                    >
                      {trade}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
