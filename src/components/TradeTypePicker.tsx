// src/components/TradeTypePicker.tsx
//
// Searchable multi-select for Contractor.tradeTypes, constrained to the
// fixed list in src/lib/trade-types.ts. Used on every form that sets
// tradeTypes (admin new-contractor, contractor profile edit) — one shared
// component so the picking experience and the underlying constraint stay
// in sync everywhere, rather than three forms each reimplementing this.
//
// Search filters trades by substring match (case-insensitive) across all
// 90 options; results stay grouped by category so someone scanning
// without typing still gets a manageable, organized list rather than one
// flat 90-item scroll.

'use client';

import { useState } from 'react';
import { TRADE_TYPE_CATEGORIES } from '@/lib/trade-types';

type TradeTypePickerProps = {
  selected: string[];
  onChange: (next: string[]) => void;
};

export default function TradeTypePicker({ selected, onChange }: TradeTypePickerProps) {
  const [query, setQuery] = useState('');

  function toggle(trade: string) {
    if (selected.includes(trade)) {
      onChange(selected.filter((t) => t !== trade));
    } else {
      onChange([...selected, trade]);
    }
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredCategories = TRADE_TYPE_CATEGORIES.map((c) => ({
    category: c.category,
    trades: normalizedQuery
      ? c.trades.filter((t) => t.toLowerCase().includes(normalizedQuery))
      : c.trades,
  })).filter((c) => c.trades.length > 0);

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {selected.map((trade) => (
            <button
              key={trade}
              type="button"
              onClick={() => toggle(trade)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
            >
              {trade}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search trades — e.g. electrical, flooring, HVAC"
        className="w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink mb-2"
      />

      <div className="max-h-[260px] overflow-y-auto border border-line rounded-[4px] p-3">
        {filteredCategories.length === 0 ? (
          <p className="text-xs text-stone">No trades match &quot;{query}&quot;.</p>
        ) : (
          filteredCategories.map((c) => (
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
                      onClick={() => toggle(trade)}
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
          ))
        )}
      </div>
    </div>
  );
}
