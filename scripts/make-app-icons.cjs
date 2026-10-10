/* eslint-disable @typescript-eslint/no-require-imports -- one-off Node tool script, not app code */
// Draws the (kalm) app icons: white square, ink wordmark in Jost with the
// site's curved brackets (same recipe as src/components/Wordmark.tsx and
// src/app/opengraph-image.tsx). Run from the app folder:
//   node scripts/make-app-icons.cjs . /some/empty/folder
// then flatten the three PNGs onto white (no transparency; iPhone prefers an
// opaque icon) and copy them over public/apple-touch-icon.png, icon-192.png
// and icon-512.png. Used on 10 Oct 2026 (KALM-301).
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');

const appDir = process.argv[2];
const outDir = process.argv[3];
const req = createRequire(path.join(appDir, 'package.json'));
const React = req('react');
const { ImageResponse } = req('next/og');
const jost = fs.readFileSync(path.join(appDir, 'assets/Jost.ttf'));

const INK = '#0a0a0b';
const BG = '#ffffff';
const h = React.createElement;

function bracket(side, height) {
  return h(
    'svg',
    {
      width: height * 0.24,
      height,
      viewBox: '0 0 24 100',
      fill: 'none',
      stroke: INK,
      strokeWidth: '5.4',
      style: { overflow: 'visible' },
    },
    h('path', { d: side === 'left' ? 'M21 0 C 3 22, 3 78, 21 100' : 'M3 0 C 21 22, 21 78, 3 100' })
  );
}

// F = letter size. The whole wordmark is about 3.6 x F wide, so F is set from
// the icon size (see the ratios below) to keep it inside the safe circle
// Android uses for round icons.
async function render(size, file, ratio) {
  const F = size * ratio;
  const node = h(
    'div',
    { style: { width: '100%', height: '100%', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Jost' } },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center' } },
      bracket('left', F * 1.1),
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontSize: F,
            fontWeight: 400,
            color: INK,
            letterSpacing: '0.2em',
            padding: `0 ${F * 0.34 - F * 0.2}px 0 ${F * 0.34}px`,
            lineHeight: 1,
          },
        },
        'kalm'
      ),
      bracket('right', F * 1.1)
    )
  );
  const res = new ImageResponse(node, { width: size, height: size, fonts: [{ name: 'Jost', data: jost, style: 'normal', weight: 400 }] });
  fs.writeFileSync(path.join(outDir, file), Buffer.from(await res.arrayBuffer()));
  console.log('wrote', file, size);
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  // iPhone only rounds the corners, so its icon can carry a bigger wordmark.
  // The 192 and 512 files are also used as the round-cropped Android icon
  // (maskable), so they keep the wordmark inside the 80% safe circle.
  await render(180, 'apple-touch-icon.png', 0.21);
  await render(192, 'icon-192.png', 0.199);
  await render(512, 'icon-512.png', 0.199);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
