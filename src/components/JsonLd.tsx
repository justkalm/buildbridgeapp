// src/components/JsonLd.tsx
//
// Structured data for search engines (schema.org JSON-LD), following the
// Next.js guide: a plain <script type="application/ld+json"> in the page.
// "<" is escaped so text typed by contractors (names, bios) can never close
// the script tag early. It is data, not code, so the CSP nonce isn't needed.

export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
