// src/components/AreaPicker.tsx
//
// Area chooser used by signup, the contractor profile and the admin add
// form: a dropdown of the Mumbai areas in src/lib/mumbai-areas.ts, plus
// "Other area" which reveals a text box. The value is always the plain area
// string, so the forms and the save routes work exactly as before.
//
// An area saved earlier that isn't on the list (older profiles) opens
// straight in "Other area" with its text filled in, so nothing is lost.
//
// allowTyping (the /join form, owner 19 Oct 2026): one text box instead of
// the dropdown. The listed areas pop up as suggestions while typing, and
// anything typed is accepted. On leaving the box a listed area is put back
// in its one spelling ("andheri w" stays as typed, "andheri west" becomes
// "Andheri West").

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
  allowTyping = false,
}: {
  id?: string;
  value: string;
  onChange: (area: string) => void;
  className: string;
  allowTyping?: boolean;
}) {
  if (allowTyping) {
    const listId = `${id ?? 'area'}-suggestions`;
    return (
      <>
        <input
          id={id}
          type="text"
          required
          maxLength={100}
          list={listId}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onChange(canonicalArea(e.target.value) ?? normalizeLocation(e.target.value))}
          placeholder="Type or pick an area, e.g. Andheri West"
          className={className}
        />
        <datalist id={listId}>
          {MUMBAI_AREAS.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </>
    );
  }

  return <AreaSelect id={id} value={value} onChange={onChange} className={className} />;
}

function AreaSelect({
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
