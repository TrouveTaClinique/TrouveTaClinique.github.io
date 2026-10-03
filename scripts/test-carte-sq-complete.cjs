'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Script } = require('node:vm');
const { generer } = require('./generer-carte-sq-complete.js');
const { lister } = require('./preparer-apercu.js');

const racine = path.join(__dirname, '..');
const lire = rel => fs.readFileSync(path.join(racine, rel), 'utf8');
const debutProto = '/* ═══════════════════════════════════════════════════════════════════════════\n   PROTOTYPE SANTÉ QUÉBEC';
const finProto = '/* Seul ajustement visuel au prototype SQ';

function tranche(html) {
  const a = html.indexOf(debutProto);
  const b = html.indexOf(finProto);
  assert.ok(a > 0 && b > a);
  return html.slice(a, b);
}

function htmlHorsPage(dir, acc) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.git' || ent.name === 'node_modules' || ent.name === 'carte-interactive') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) htmlHorsPage(p, acc);
    else if (ent.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

test('La page est produite par le script, deux fois de suite à l’identique', () => {
  const page = generer();
  assert.equal(generer(), page);
  assert.equal(lire('carte-interactive/index.html'), page);
});

test('Le bloc prototype, l’épingle et le logo restent ceux du gabarit Est', () => {
  const gabarit = lire('scripts/carte-est-sq.template.html').replace(/\r\n/g, '\n');
  const page = lire('carte-interactive/index.html');
  assert.equal(tranche(page), tranche(gabarit));
  assert.equal(page.match(/--app-pin:[^\n]*/)[0], gabarit.match(/--app-pin:[^\n]*/)[0]);
  assert.equal(page.match(/--app-logo:[^\n]*/)[0], gabarit.match(/--app-logo:[^\n]*/)[0]);
});

test('La page reste non répertoriée et charge toute la Montérégie', () => {
  const page = lire('carte-interactive/index.html');
  assert.match(page, /<html lang="fr-CA" data-region="Est">/);
  assert.match(page, /name="robots" content="noindex, nofollow"/);
  assert.match(page, /Segoe UI/);
  assert.match(page, /max-width: 860px/);
  assert.doesNotMatch(page, /kaushan/i);
  assert.doesNotMatch(page, /rel="manifest"/);
  assert.doesNotMatch(page, /serviceWorker/);
  assert.doesNotMatch(page, /g\.region === 'Est'/);
  assert.doesNotMatch(page, /h\.region !== 'Est'/);
  assert.match(page, /data-etablissements\.json/);
  assert.match(page, /data-etablissements-centre\.json/);
  assert.doesNotMatch(page, /fiches-publiques\.json|Renseignements publics/);
  assert.match(page, /vw-label\">Dossier médical/);
  assert.match(page, /vw-label\">Besoin déclaré/);
  assert.match(page, /vw-label\">Téléphone/);
  assert.match(page, /ttc-sq-mtg-note-/);
  assert.doesNotMatch(page, /dtmf-mtg-note-/);
  assert.match(page, /trouvetaclinique\.ca\/carte-interactive\//);
  assert.doesNotMatch(page, /trouvetaclinique\.ca\/monteregie-est\//);
  assert.match(page, /id="reg-filter"/);
  assert.match(page, /id="rls-filter"/);
  assert.doesNotMatch(page, /id="rls-btns"/);
  assert.match(page, /Tous les RLS/);
  assert.match(page, /'Est': '#0080D7', 'Centre': '#08A0A0', 'Ouest': '#170A72'/);
  assert.match(page, /'Est': '#A8DCF4', 'Centre': '#A7DFDC', 'Ouest': '#B8B1DF'/);
  assert.match(page, /ligne\('#0080D7', 'Montérégie-Est'\)/);
  assert.match(page, /ligne\('#08A0A0', 'Montérégie-Centre'\)/);
  assert.match(page, /ligne\('#170A72', 'Montérégie-Ouest'\)/);
  assert.doesNotMatch(page, /#e6007e|#43a047|#f48cc5/);
  for (const inventee of ['#0A6B5C', '#9A4A16', '#1A4578', '#4C3D78', '#8A3050', '#2F5A3C']) {
    assert.equal(page.includes(inventee), false, inventee);
  }
  assert.equal((page.match(/name="robots"/g) || []).length, 1);
  const re = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(page))) {
    if (m[1].trim()) new Script(m[1]);
  }
  assert.doesNotMatch(lire('sitemap.xml'), /carte-interactive/);
  assert.doesNotMatch(lire('recherche/donnees.json'), /carte-interactive/);
  assert.doesNotMatch(lire('scripts/generer-pages-seo.js'), /carte-interactive/);
  const robots = lire('robots.txt');
  assert.match(robots, /^User-agent: \*\nAllow: \/\n/);
  assert.doesNotMatch(robots, /Disallow|carte-interactive/);
  for (const fichier of htmlHorsPage(racine, [])) {
    assert.doesNotMatch(lire(path.relative(racine, fichier)), /carte-interactive/, fichier);
  }
  assert.ok(lister(racine).includes('carte-interactive/index.html'));
  assert.ok(!lister(racine).includes('carte-interactive/fiches-publiques.json'));
});
