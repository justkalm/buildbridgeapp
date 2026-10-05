// src/app/opengraph-image.tsx
//
// The picture shown when a (kalm) link is shared on WhatsApp, iMessage, X and
// so on: the wordmark and tagline, in the same face, colours and bracket
// shapes as the site (see src/components/Wordmark.tsx). Drawn once at build
// time and cached. Contractor profiles set their own preview, so this is the
// default for every other page.
//
// The font is a local copy of Jost frozen at weight 350 (assets/Jost.ttf, Open Font Licence; the
// generator cannot read variable fonts). The
// image generator cannot read the web font that next/font serves, and
// bundling the file means nothing is fetched while the image is made.

import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = '(kalm) | Kaam. Connected.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const jost = await readFile(join(process.cwd(), 'assets/Jost.ttf'));

const INK = '#0a0a0b';
const PAPER = '#fafaf8';
const STONE = '#6b6963';

// Same curves as the Wordmark component, sized in pixels instead of em.
function Bracket({ side, height }: { side: 'left' | 'right'; height: number }) {
  return (
    <svg
      width={height * 0.24}
      height={height}
      viewBox="0 0 24 100"
      fill="none"
      stroke={INK}
      strokeWidth="5.4"
      style={{ overflow: 'visible' }}
    >
      {side === 'left' ? <path d="M21 0 C 3 22, 3 78, 21 100" /> : <path d="M3 0 C 21 22, 21 78, 3 100" />}
    </svg>
  );
}

export default async function Image() {
  const letters = 190;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: PAPER,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Jost',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Bracket side="left" height={letters * 1.1} />
          <div
            style={{
              display: 'flex',
              fontSize: letters,
              fontWeight: 400,
              color: INK,
              letterSpacing: '0.2em',
              padding: `0 ${letters * 0.34 - letters * 0.2}px 0 ${letters * 0.34}px`,
              lineHeight: 1,
            }}
          >
            kalm
          </div>
          <Bracket side="right" height={letters * 1.1} />
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 56,
            fontSize: 40,
            fontWeight: 400,
            color: STONE,
            letterSpacing: '0.22em',
          }}
        >
          Kaam. Connected.
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Jost', data: jost, style: 'normal', weight: 400 }] },
  );
}
