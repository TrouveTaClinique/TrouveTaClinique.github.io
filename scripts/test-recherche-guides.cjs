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

// Questions en phrase complète (moteur optimisé : correspondance partielle, rareté, concepts).
const premiers = (requete, n) => titres(requete).slice(0, n);

test('phrase : otite + allergie à la pénicilline trouve les deux sujets', () => {
  const res = premiers('otite chez un enfant allergique à la pénicilline', 5);
  assert.ok(contient(res, /otite/), res.join(' | '));
  assert.ok(contient(res, /penicilline/), res.join(' | '));
});

test('phrase : bouffées de chaleur mène à la ménopause', () => {
  assert.ok(contient(premiers('bouffées de chaleur à la ménopause, quelles options?', 3), /menopause/));
  assert.ok(contient(premiers('bouffées de chaleur', 3), /menopause/));
});

test('phrase : les chiffres et mots de question sont ignorés', () => {
  assert.match(R.normaliser(premiers('bébé de 3 semaines avec de la fièvre', 1)[0]), /fievre nourrisson/);
});

test('concept : apixaban mène aux guides sur les anticoagulants', () => {
  assert.ok(contient(premiers('patient sous apixaban avant une coloscopie', 3), /anticoag/));
});

test('concept : toux chez un fumeur mène à la MPOC', () => {
  const res = premiers('toux depuis 4 semaines chez un fumeur de 60 ans', 6);
  assert.ok(contient(res, /mpoc/), res.join(' | '));
});

test('fumeur mène aussi au dépistage (cancer du poumon)', () => {
  assert.ok(contient(titres('fumeur'), /depistage/));
});

test('deux mots-clés sans guide commun : chacun garde ses résultats', () => {
  const res = titres('otite pénicilline');
  assert.ok(contient(res, /otite/) && contient(res, /penicilline/), res.join(' | '));
});

// Questions hors catalogue : aucun résultat plutôt que des guides sans rapport.
test('hors catalogue : pas de faux résultat', () => {
  for (const q of ['banque alimentaire', 'hébergement femme violence', 'proche aidant épuisé', 'organisme deuil', 'aide à domicile personne âgée']) {
    assert.deepEqual(titres(q), [], q);
  }
});

test('questions communautaires reconnues, questions cliniques non', () => {
  for (const q of ['banque alimentaire', 'répit pour proche aidant', 'maison d’hébergement', 'centre d’action bénévole', '211']) assert.ok(R.estCommunautaire(q), q);
  for (const q of ['otite', 'sevrage alcool', 'fibrillation auriculaire']) assert.ok(!R.estCommunautaire(q), q);
});
