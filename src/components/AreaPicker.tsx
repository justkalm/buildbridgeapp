// src/components/AreaPicker.tsx
//
// Area chooser used by signup, the contractor profile and the admin add
// form: a dropdown of the Mumbai areas in src/lib/mumbai-areas.ts, plus
// "Other area" which reveals a text box. The value is always the plain area
// string, so the forms and the save routes work exactly as before.
//
// An area saved earlier that isn't on the list (older profiles) opens
// straight in "Other area" with its text filled in, so nothing is lost.

'use client';

import { useState } from 'react';
import { MUMBAI_AREAS, canonicalArea } from '@/lib/mumbai-areas';
import { normalizeLocation } from '@/lib/location';

const OTHER = '__other__';

export default function AreaPicker({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  onChange: (area: string) => void;
  className: string;
}) {
  const listed = canonicalArea(value);
  const [otherChosen, setOtherChosen] = useState(false);
  const showOther = otherChosen || (value.trim() !== '' && !listed);

  return (
    <div className="flex flex-col gap-2">
      <select
        id={id}
        value={showOther ? OTHER : (listed ?? '')}
        required={!showOther}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTHER) {
            setOtherChosen(true);
            onChange('');
          } else {
            setOtherChosen(false);
            onChange(v);
          }
        }}
        className={className}
      >
        <option value="">Select your area</option>
        {MUMBAI_AREAS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
        <option value={OTHER}>Other area</option>
      </select>
      {showOther && (
        <input
          type="text"
          required
          maxLength={100}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onChange(normalizeLocation(e.target.value))}
          placeholder="Type your area"
          aria-label="Your area"
          className={className}
        />
      )}
    </div>
  );
}
