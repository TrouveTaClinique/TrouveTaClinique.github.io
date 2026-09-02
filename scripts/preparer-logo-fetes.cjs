#!/usr/bin/env node
/*
 * Détoure une épingle fêtes (fond noir + trou central transparent, bonnet conservé).
 * Usage : node scripts/preparer-logo-fetes.cjs <source.jpg|png> <sortie.png>
 */
'use strict';

const fs = require('fs');
const path = require('path');

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) {
  console.error('Usage : node scripts/preparer-logo-fetes.cjs <source> <sortie.png>');
  process.exit(1);
}

let sharp;
try {
  sharp = require('sharp');
} catch {
  sharp = require(path.join(require('os').tmpdir(), 'logo-proc', 'node_modules', 'sharp'));
}

const BLACK_MAX = 28;
const WHITE_MIN = 235;

function idx(w, x, y) {
  return (y * w + x) * 4;
}

async function main() {
  const { data, info } = await sharp(input)
    .resize(168, 168, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h } = info;
  const px = Buffer.from(data);

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    if (r <= BLACK_MAX && g <= BLACK_MAX && b <= BLACK_MAX) px[i + 3] = 0;
  }

  const visited = new Uint8Array(w * h);
  const stack = [[Math.floor(w / 2), Math.floor(h / 2)]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = idx(w, x, y);
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const a = px[i + 3];
    if (!a) continue;
    if (r >= WHITE_MIN && g >= WHITE_MIN && b >= WHITE_MIN) {
      px[i + 3] = 0;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  await sharp(px, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(output);
  console.log('Écrit', output, `(${w}×${h})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
