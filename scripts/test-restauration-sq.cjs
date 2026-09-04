'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const racine = path.join(__dirname, '..');
const lire = p => fs.readFileSync(path.join(racine, p), 'utf8');
const h = s => createHash('sha256').update(s).digest('hex');
const est = lire('monteregie-est/index.html');

test('Le bloc SQ historique est conservé intégralement, avec V4 et Segoe UI', () => {
  const debut = est.indexOf('/* ═══════════════════════════════════════════════════════════════════════════\n   PROTOTYPE SANTÉ QUÉBEC');
  const fin = est.indexOf('/* Seul ajustement visuel au prototype SQ');
  assert.ok(debut > 0 && fin > debut);
  assert.equal(h(est.slice(debut, fin).trim()), 'cc946ebb572c23d49858e5486515e56ee9fee1e981632c87d90c92fbcc831718');
  assert.match(est, /<html lang="fr" data-region="Est">/);
  assert.match(est, /linear-gradient\(100deg, var\(--sq-bleu\) 0%, var\(--sq-bleu\) 42%, var\(--sq-sarcelle\) 100%\)/);
  assert.match(est, /\.brand-mot[\s\S]*?font-family: var\(--sq-font\)/);
  assert.equal(est.match(/--app-logo:.*$/m)[0], lire('scripts/carte.template.html').match(/--app-logo:.*$/m)[0]);
  for (const couleur of ['#0080D7', '#08A0A0', '#170A72', '#A8DCF4', '#A7DFDC', '#B8B1DF']) assert.ok(est.includes(couleur));
});

test('Les deux onglets sont rétablis sans bulle d\'information', () => {
  assert.match(est, /id="care-mode-switch" role="tablist"/);
  assert.match(est, /data-mode="cliniques" role="tab" aria-selected="true"/);
  assert.match(est, /data-mode="etablissements" role="tab" aria-selected="false"/);
  assert.doesNotMatch(est, /etab-count/);
  assert.doesNotMatch(est, /id="etablissements-info"/);
  assert.doesNotMatch(est, /id="etablissements-tip"/);
  assert.doesNotMatch(est, /class="care-mode-etab"/);
});

test('Le panneau scinde tete fixe et zone defilante', () => {
  assert.match(est, /class="sb-scroll" id="sb-scroll"/);
  const tete = est.slice(est.indexOf('class="sb-head"'), est.indexOf('id="sb-scroll"'));
  assert.match(tete, /id="filtre-territoire-wrap"/);
  assert.match(tete, /id="filtre-territoire-label" hidden>Territoire/);
  assert.doesNotMatch(est, /territoireFiltreOuvert/);
  assert.doesNotMatch(est, /territoire\.open = false/);
  assert.match(tete, /class="sb-view-row"/);
  assert.doesNotMatch(tete, /id="activite-panel"/);
  assert.doesNotMatch(tete, /id="cmp-export-btn"/);
  const defile = est.slice(est.indexOf('id="sb-scroll"'), est.indexOf('id="map"'));
  assert.match(defile, /id="activite-panel"/);
  assert.match(defile, /id="cmp-export-btn"/);
  assert.match(defile, /id="sb-list"/);
  assert.match(est, /modeCarte === 'cliniques' && favOnly && n >= 2/);
});

test('Les scripts de la carte compilent et les dépendances/PWA gardent les bonnes routes', () => {
  let n = 0;
  for (const m of est.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/application\/ld\+json/.test(m[1])) { JSON.parse(m[2]); continue; }
    if (m[2].trim()) { new vm.Script(m[2], { filename: 'carte-est-script-' + (++n) }); }
  }
  assert.ok(n >= 5);
  for (const m of est.matchAll(/(?:src|href)="(\.\.\/[^"]+)"/g)) {
    if (/^\.\.\/[^?#]+$/.test(m[1])) assert.ok(fs.existsSync(path.resolve(racine, 'monteregie-est', m[1])), m[1]);
  }
  assert.match(est, /fetch\('\.\.\/data\.json', \{ cache: 'no-cache' \}\)/);
  assert.match(est, /scope: '\/monteregie-est\/'/);
  assert.match(lire('sw.js'), /v64-accueil-fraiche/);
  assert.doesNotMatch(est, /olaplante\.github\.io\/Monteregie-Est/);
});

test('La génération est stable et ne change ni données ni autres cartes', () => {
  const fichiers = ['data.json', 'monteregie/index.html', 'monteregie-est/index.html',
    'monteregie-centre/index.html', 'monteregie-ouest/index.html'];
  const avant = fichiers.map(p => h(lire(p)));
  execFileSync(process.execPath, [path.join(__dirname, 'publier-regions.js')], { cwd: racine });
  assert.deepEqual(fichiers.map(p => h(lire(p))), avant);
  assert.ok(lire('scripts/carte.template.html').includes('--cream: #f8f6f1'));
  for (const p of ['monteregie/index.html', 'monteregie-centre/index.html', 'monteregie-ouest/index.html']) {
    assert.ok(!lire(p).includes('PROTOTYPE SANTÉ QUÉBEC'));
  }
  assert.ok(lire('README.md').includes('[Voir le site](https://trouvetaclinique.ca/)'));
  assert.ok(lire('README.md').includes('apercu.trouvetaclinique.ca'));
});
