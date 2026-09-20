'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const MOIS_FR_SEO = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function dateLisibleFr(iso) {
  const m = typeof iso === 'string' && iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const mois = MOIS_FR_SEO[parseInt(m[2], 10) - 1];
  return mois ? `${parseInt(m[3], 10)} ${mois} ${m[1]}` : '';
}

function renumeroterSectionsGuide(html) {
  const MOTIF = /(<p class="section-number">)(\d+)(<\/p>)/g;
  const segments = html.split(/(<!--[\s\S]*?-->)/);
  let n = 0;
  const sortie = segments.map(segment => {
    if (segment.startsWith('<!--')) return segment;
    return segment.replace(MOTIF, (_, avant, __, apres) => {
      n += 1;
      return avant + String(n).padStart(2, '0') + apres;
    });
  }).join('');
  return { html: sortie, total: n };
}

test('dates ISO rendues en français, identiques UTC et Toronto', () => {
  const avant = process.env.TZ;
  try {
    process.env.TZ = 'UTC';
    const utc = dateLisibleFr('2026-09-14');
    process.env.TZ = 'America/Toronto';
    const toronto = dateLisibleFr('2026-09-14');
    assert.equal(utc, '14 septembre 2026');
    assert.equal(toronto, utc);
    assert.equal(dateLisibleFr('juin 2026'), '');
    assert.equal(dateLisibleFr(''), '');
    assert.equal(dateLisibleFr('2026-13-40'), '');
  } finally {
    if (avant === undefined) delete process.env.TZ;
    else process.env.TZ = avant;
  }
});

test('renumérotation PTEM hors commentaires, ancres inchangées', () => {
  const source = [
    '<p class="section-number">01</p><h2 id="s1">A</h2>',
    '<!-- <p class="section-number">04</p><h2 id="masque">MASQUE TEMPORAIRE</h2> -->',
    '<p class="section-number">06</p><h2 id="s2">B</h2>',
    '<p class="section-number">99</p><h2 id="s3">C</h2>'
  ].join('\n');
  const { html, total } = renumeroterSectionsGuide(source);
  assert.equal(total, 3);
  assert.match(html, /<p class="section-number">01<\/p><h2 id="s1">/);
  assert.match(html, /<p class="section-number">02<\/p><h2 id="s2">/);
  assert.match(html, /<p class="section-number">03<\/p><h2 id="s3">/);
  assert.match(html, /id="masque"/);
  assert.match(html, /<!--[\s\S]*<p class="section-number">04<\/p>/);
});

test('ajout d\'une section visible : numéros 01 à 04', () => {
  const source = [
    '<p class="section-number">01</p>',
    '<p class="section-number">02</p>',
    '<p class="section-number">08</p>',
    '<p class="section-number">10</p>'
  ].join('\n');
  const { html, total } = renumeroterSectionsGuide(source);
  assert.equal(total, 4);
  assert.equal(html.match(/<p class="section-number">\d+<\/p>/g).join(''),
    '<p class="section-number">01</p><p class="section-number">02</p><p class="section-number">03</p><p class="section-number">04</p>');
});
