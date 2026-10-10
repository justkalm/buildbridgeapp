/* eslint-disable @typescript-eslint/no-require-imports -- one-off Node tool script, not app code */
// Draws the (k) mark for the browser tab icon (src/app/favicon.ico): black on
// white, as the site's wordmark draws it (Jost letter, curved brackets). Run
// from the app folder: node scripts/make-favicon.cjs . /some/empty/folder
// This writes A.png (512 pixels). Then shrink it to 16, 32 and 48 pixels and
// save them together as an .ico over src/app/favicon.ico (Pillow's
// Image.save(..., format='ICO', sizes=[(16,16),(32,32),(48,48)]) does it).
// Convert to RGBA first (opaque white): the Next build refuses an .ico whose
// small pictures have no transparency channel.
// Used on 10 Oct 2026 (KALM-302).
const { createRequire } = require('module');
const fs = require('fs'); const path = require('path');
const appDir = process.argv[2], outDir = process.argv[3];
const req = createRequire(path.join(appDir, 'package.json'));
const React = req('react'); const { ImageResponse } = req('next/og');
const jost = fs.readFileSync(path.join(appDir, 'assets/Jost.ttf'));
const h = React.createElement; const INK = '#0a0a0b';
const bracket = (side, ht, sw) => h('svg', { width: ht * 0.24, height: ht, viewBox: '0 0 24 100', fill: 'none', stroke: INK, strokeWidth: String(sw), style: { overflow: 'visible' } },
  h('path', { d: side === 'left' ? 'M21 0 C 3 22, 3 78, 21 100' : 'M3 0 C 21 22, 21 78, 3 100' }));
async function draw(file, { F, sw, pad, bh }) {
  const node = h('div', { style: { width: '100%', height: '100%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Jost' } },
    h('div', { style: { display: 'flex', alignItems: 'center' } },
      bracket('left', F * bh, sw),
      h('div', { style: { display: 'flex', fontSize: F, color: INK, lineHeight: 1, padding: `0 ${F * pad}px` } }, 'k'),
      bracket('right', F * bh, sw)));
  const res = new ImageResponse(node, { width: 512, height: 512, fonts: [{ name: 'Jost', data: jost, style: 'normal', weight: 400 }] });
  fs.writeFileSync(path.join(outDir, file), Buffer.from(await res.arrayBuffer()));
}
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  // the mark as the brand draws it (thin, same proportions as the wordmark)
  await draw('A.png', { F: 250, sw: 5.4, pad: 0.34, bh: 1.1 });
})();
