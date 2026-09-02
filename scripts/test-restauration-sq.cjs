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
const info = 'Un établissement est une installation publique du réseau de la santé (CLSC, Hôpital, CHSLD, Centre de Réadaptation, etc.)';

test('Le bloc SQ historique est conservé intégralement, avec V4 et Segoe UI', () => {
  const debut = est.indexOf('/* ═══════════════════════════════════════════════════════════════════════════\n   PROTOTYPE SANTÉ QUÉBEC');
  const fin = est.indexOf('/* Seul ajustement visuel au prototype SQ');
  assert.ok(debut > 0 && fin > debut);
  assert.equal(h(est.slice(debut, fin).trim()), '2cbd29beb301e936a1a9c3d82474cc149e848c5d9b8868d027285dbd819fb117');
  assert.match(est, /<html lang="fr" data-region="Est">/);
  assert.match(est, /linear-gradient\(100deg, var\(--sq-bleu\) 0%, var\(--sq-bleu\) 42%, var\(--sq-sarcelle\) 100%\)/);
  assert.match(est, /\.brand-mot[\s\S]*?font-family: var\(--sq-font\)/);
  assert.equal(est.match(/--app-logo:.*$/m)[0], lire('scripts/carte.template.html').match(/--app-logo:.*$/m)[0]);
  for (const couleur of ['#0080D7', '#08A0A0', '#170A72', '#A8DCF4', '#A7DFDC', '#B8B1DF']) assert.ok(est.includes(couleur));
});

test('Les deux onglets sont rétablis et le i contient exactement le texte demandé', () => {
  assert.match(est, /id="care-mode-switch" role="tablist"/);
  assert.match(est, /data-mode="cliniques" role="tab" aria-selected="true"/);
  assert.match(est, /data-mode="etablissements" role="tab" aria-selected="false"/);
  assert.ok(est.includes(info));
  assert.doesNotMatch(est, /etab-count/);
  assert.match(est, /id="etablissements-info"[^>]*aria-controls="etablissements-tip"/);
  assert.match(est, /id="etablissements-tip" role="tooltip" hidden/);
});

test('Le i fonctionne au clic, au survol et avec Échap sans activer un onglet', () => {
  function element() {
    return { handlers: {}, attrs: {}, addEventListener(n, f) { this.handlers[n] = f; },
      setAttribute(n, v) { this.attrs[n] = v; }, focus() {} };
  }
  const bouton = element(), bulle = { hidden: true }, parent = element(), document = element();
  parent.contains = cible => cible === bouton || cible === bulle;
  bouton.parentElement = parent;
  document.getElementById = id => id === 'etablissements-info' ? bouton : bulle;
  const script = [...est.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).find(s => s.includes('// Le bouton d’information') || s.includes("// Le bouton d'information"));
  assert.ok(script);
  vm.runInNewContext(script, { document });
  const e = { stopPropagation() {}, preventDefault() {}, stopImmediatePropagation() {} };
  bouton.handlers.mouseenter();
  assert.equal(bulle.hidden, false);
  bouton.handlers.click(e);
  assert.equal(bulle.hidden, false);
  assert.equal(bouton.attrs['aria-expanded'], 'true');
  bouton.handlers.click(e);
  assert.equal(bulle.hidden, true);
  bouton.handlers.click(e);
  document.handlers.keydown({ ...e, key: 'Escape' });
  assert.equal(bulle.hidden, true);
  bouton.handlers.click(e);
  document.handlers.click({ target: {} });
  assert.equal(bulle.hidden, true);
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
  assert.match(lire('sw.js'), /v53-sq-restaure/);
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
  assert.ok(lire('README.md').includes('[Voir le brouillon Montérégie-Est](https://trouvetaclinique.github.io/monteregie-est/)'));
});
