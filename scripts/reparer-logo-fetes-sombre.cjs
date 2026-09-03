#!/usr/bin/env node
/**
 * Répare logo-fetes-sombre.png : détourage + suppression du halo blanc autour du point bleu.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.join(__dirname, '..');
const target = path.join(root, 'assets/source/logo-fetes-sombre.png');

let sharp;
try {
  sharp = require('sharp');
} catch {
  sharp = require(path.join(os.tmpdir(), 'logo-proc', 'node_modules', 'sharp'));
}

const BLACK_MAX = 28;
const WHITE_MIN = 235;

function idx(w, x, y) {
  return (y * w + x) * 4;
}

function isNeutralLight(r, g, b) {
  const mn = Math.min(r, g, b);
  const mx = Math.max(r, g, b);
  return mn >= 215 && mx - mn <= 28;
}

function isTealBody(r, g, b) {
  return g >= 120 && r <= 72 && b >= 70;
}

function isBlueDot(r, g, b) {
  return b >= 140 && b >= g + 12 && r <= 110;
}

/** Lisière cyan pâle entre le point bleu et le corps teal (visible en mode sombre). */
function isGapBlend(r, g, b) {
  if (isTealBody(r, g, b) || isBlueDot(r, g, b)) return false;
  if (r < 70 || g < 145) return false;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (spread > 55) return false;
  if (r / g > 0.5 && Math.abs(g - b) < 45) return true;
  const mn = Math.min(r, g, b);
  return mn >= 175 && spread <= 50;
}

function clearGapAroundBlueDot(px, w, h) {
  const x0 = 96;
  const y0 = 102;
  for (let y = y0; y < h; y++) {
    for (let x = x0; x < w; x++) {
      const i = idx(w, x, y);
      if (!px[i + 3]) continue;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      if (isGapBlend(r, g, b)) px[i + 3] = 0;
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (let y = y0; y < h; y++) {
      for (let x = x0; x < w; x++) {
        const i = idx(w, x, y);
        if (!px[i + 3]) continue;
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        if (!isGapBlend(r, g, b) && !isNeutralLight(r, g, b)) continue;
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ]) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (!px[idx(w, nx, ny) + 3]) {
            px[i + 3] = 0;
            changed = true;
            break;
          }
        }
      }
    }
  }

  const isMilkyEdge = (r, g, b) => {
    if (isSolidTeal(r, g, b) || isSolidBlue(r, g, b)) return false;
    if (r > 32 && r < 115 && g >= 128 && b >= 95) return true;
    if (b >= 175 && r >= 30 && g >= 95) return true;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (spread <= 25 && Math.min(r, g, b) >= 55) return true;
    return isGapBlend(r, g, b) || isNeutralLight(r, g, b);
  };

  for (let pass = 0; pass < 10; pass++) {
    changed = false;
    for (let y = 106; y < 118; y++) {
      for (let x = 102; x < 130; x++) {
        const i = idx(w, x, y);
        if (!px[i + 3]) continue;
        if (!isMilkyEdge(px[i], px[i + 1], px[i + 2])) continue;
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ]) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (!px[idx(w, nx, ny) + 3]) {
            px[i + 3] = 0;
            changed = true;
            break;
          }
        }
      }
    }
    if (!changed) break;
  }
}

function isSolidTeal(r, g, b) {
  return g >= 120 && r <= 32 && b >= 70;
}

function isSolidBlue(r, g, b) {
  return b >= 175 && r <= 25 && g <= 145;
}

async function main() {
  const { data, info } = await sharp(target)
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

  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = idx(w, x, y);
        if (!px[i + 3]) continue;
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        if (!isNeutralLight(r, g, b)) continue;
        const neighbors = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (!px[idx(w, nx, ny) + 3]) {
            px[i + 3] = 0;
            changed = true;
            break;
          }
        }
      }
    }
  }

  const mark = new Uint8Array(w * h);
  for (let sy = 90; sy < h; sy++) {
    for (let sx = 90; sx < w; sx++) {
      const sp = sy * w + sx;
      if (mark[sp]) continue;
      const si = idx(w, sx, sy);
      if (!px[si + 3]) continue;
      const sr = px[si];
      const sg = px[si + 1];
      const sb = px[si + 2];
      if (!isNeutralLight(sr, sg, sb)) continue;
      const blob = [];
      const q = [[sx, sy]];
      mark[sp] = 1;
      let touchesTop = false;
      while (q.length) {
        const [x, y] = q.pop();
        blob.push([x, y]);
        if (y < 55) touchesTop = true;
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ]) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const p = ny * w + nx;
          if (mark[p]) continue;
          const i = idx(w, nx, ny);
          if (!px[i + 3]) continue;
          if (!isNeutralLight(px[i], px[i + 1], px[i + 2])) continue;
          mark[p] = 1;
          q.push([nx, ny]);
        }
      }
      if (!touchesTop && blob.length > 0 && blob.length < 400) {
        for (const [x, y] of blob) px[idx(w, x, y) + 3] = 0;
      }
    }
  }

  clearGapAroundBlueDot(px, w, h);

  await sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toFile(target);
  console.log('Réparé', target);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
