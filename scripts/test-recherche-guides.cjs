'use strict';

// Recherche du catalogue /guides/ : synonymes, fautes de frappe, pluriel, pertinence
// et absence de faux positifs sur les abréviations courtes. Données réelles du catalogue.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const R = require('../assets/guides-recherche.js');

const ressources = require(path.join(__dirname, '..', 'guides', 'donnees.json'));
const index = ressources.map(r => R.preparer({ titre: r.title, organisme: r.org, categorie: r.cat, motsCles: r.tags, description: r.desc }));
const titres = requete => R.rechercher(index, requete).map(x => ressources[x.i].title);
const contient = (liste, motif) => liste.some(t => motif.test(R.normaliser(t)));

test('MPOC, BPCO et COPD trouvent les mêmes guides', () => {
  const mpoc = titres('MPOC'), bpco = titres('BPCO'), copd = titres('COPD');
  assert.ok(mpoc.length >= 5);
  assert.deepEqual(new Set(bpco), new Set(mpoc));
  assert.deepEqual(new Set(copd), new Set(mpoc));
});

test('FA trouve la fibrillation auriculaire, pas « famille »', () => {
  const fa = titres('FA');
  assert.ok(contient(fa, /fibrillation auriculaire/));
  assert.ok(!contient(fa, /famille/), fa.join(' | '));
});

test('IC trouve l’insuffisance cardiaque, sans faux positif sur « clinique »', () => {
  const ic = titres('IC');
  assert.ok(contient(ic, /insuffisance cardiaque/));
  assert.ok(!contient(ic, /clinique/), ic.join(' | '));
});

test('TVP trouve la thrombose veineuse profonde', () => {
  assert.ok(contient(titres('TVP'), /thrombose veineuse profonde/));
});

test('Ste-Justine, Sainte-Justine et CHUSJ donnent les mêmes résultats', () => {
  const a = titres('Ste-Justine'), b = titres('Sainte-Justine'), c = titres('CHUSJ');
  assert.ok(a.length > 100);
  assert.equal(a.length, b.length);
  assert.equal(a.length, c.length);
});

test('tolère une faute de frappe', () => {
  assert.ok(contient(titres('pneumonei'), /pneumonie/));
  assert.ok(contient(titres('bronchiolyte'), /bronchiolite/));
  assert.ok(contient(titres('fibrilation auriculaire'), /fibrillation auriculaire/));
});

test('tolère le pluriel', () => {
  assert.deepEqual(new Set(titres('otites')), new Set(titres('otite')));
  assert.ok(contient(titres('infections urinaires'), /infection urinaire/));
});

test('le titre passe avant les mots-clés', () => {
  const res = titres('laryngite');
  assert.match(R.normaliser(res[0]), /laryngite/);
});

test('mots vides ignorés : « fibrillation auriculaire chez l’adulte »', () => {
  assert.ok(contient(titres('fibrillation auriculaire chez l’adulte'), /fibrillation auriculaire/));
});

test('saisie partielle : « pneumo » trouve la pneumonie', () => {
  assert.ok(contient(titres('pneumo'), /pneumonie/));
});

test('requête sans résultat', () => {
  assert.equal(titres('zzzzqqq').length, 0);
});
