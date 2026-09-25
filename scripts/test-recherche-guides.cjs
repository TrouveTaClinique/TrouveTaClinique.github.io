'use strict';

// Recherche du catalogue /guides/ : synonymes, fautes de frappe, pluriel, pertinence
// et absence de faux positifs sur les abréviations courtes. Données réelles du catalogue.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const R = require('../assets/guides-recherche.js');

const ressources = require(path.join(__dirname, '..', 'guides', 'donnees.json'));
// Même indexation que la page (assets/guides-cliniques.js) : pour un organisme, la ville compte comme le nom.
const index = ressources.map(r => r.type === 'communautaire'
  ? R.preparer({ titre: r.title + ' ' + r.ville, organisme: '', categorie: r.cat + ' ' + r.rubriques.join(' '), motsCles: r.tags, description: r.desc })
  : R.preparer({ titre: r.title, organisme: r.org, categorie: r.cat, motsCles: r.tags, description: r.desc }));
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

// Questions hors catalogue : aucun résultat plutôt que des ressources sans rapport.
test('hors catalogue : pas de faux résultat', () => {
  for (const q of ['réparation de voiture', 'billet d’avion pour Cuba', 'recette de gâteau']) {
    assert.deepEqual(titres(q), [], q);
  }
});

test('questions communautaires reconnues, questions cliniques non', () => {
  for (const q of ['banque alimentaire', 'répit pour proche aidant', 'maison d’hébergement', 'centre d’action bénévole', '211']) assert.ok(R.estCommunautaire(q), q);
  for (const q of ['otite', 'sevrage alcool', 'fibrillation auriculaire', 'transport de patients']) assert.ok(!R.estCommunautaire(q), q);
});

// Organismes communautaires (bottin) : classement selon le type de question.
const communautaires = ressources.map(r => r.type === 'communautaire');
const parType = (q, n = 5) => R.rechercherParType(index, communautaires, q).slice(0, n).map(x => ressources[x.i]);

test('communautaire : banque alimentaire mène aux organismes d’aide alimentaire', () => {
  const res = parType('banque alimentaire');
  assert.ok(res.length >= 3);
  assert.ok(res.every(r => r.type === 'communautaire' && /alimentaire|repas/i.test(r.rubriques.join(' '))), res.map(r => r.title).join(' | '));
});

test('communautaire : hébergement pour femme victime de violence', () => {
  const res = parType('hébergement femme violence conjugale');
  assert.ok(res.length && res.every(r => r.type === 'communautaire'), res.map(r => r.title).join(' | '));
  assert.ok(res.slice(0, 3).some(r => /Femmes/.test(r.rubrique)), res.map(r => r.title).join(' | '));
});

test('communautaire : la ville départage (aide alimentaire à Saint-Amable)', () => {
  const res = parType('aide alimentaire Saint-Amable', 3);
  assert.equal(res[0].title, 'Centre d’Entraide Bénévole', res.map(r => r.title).join(' | '));
});

test('clinique : les guides passent devant les organismes (sevrage alcool)', () => {
  const res = parType('sevrage alcool', 3);
  assert.ok(res.every(r => r.type !== 'communautaire'), res.map(r => r.title).join(' | '));
});

test('documents pour les patients : benzodiazépines et côlon irritable', () => {
  assert.ok(contient(parType('sevrage benzodiazépine', 3).map(r => r.title), /somniferes/), parType('sevrage benzodiazépine', 3).map(r => r.title).join(' | '));
  assert.ok(contient(parType('côlon irritable', 2).map(r => r.title), /colon irritable/));
});

test('algorithmes : mal de dos, tennis elbow, déprescription des IPP', () => {
  assert.ok(contient(parType('mal de dos aigu', 3).map(r => r.title), /lombalgie aigue/), parType('mal de dos aigu', 3).map(r => r.title).join(' | '));
  assert.ok(contient(parType('tennis elbow', 2).map(r => r.title), /epicondylite/));
  assert.ok(contient(parType('arrêter pantoprazole', 3).map(r => r.title), /pompe a protons/), parType('arrêter pantoprazole', 3).map(r => r.title).join(' | '));
});

/* Revue du moteur (25 septembre 2026) : faux positifs corrigés. */
test('fautes : « urticaire » ne devient pas « urinaire », ni « jaunisse » « jeunesse »', () => {
  assert.ok(!contient(titres('urticaire'), /urinaire/), titres('urticaire').join(' | '));
  assert.ok(!contient(titres('jaunisse nouveau-né'), /jeunesse|immunisation/), titres('jaunisse nouveau-né').join(' | '));
});

test('mot générique seul : « toux chronique » ne ramène pas la constipation', () => {
  assert.ok(!contient(titres('toux chronique'), /constipation|diarrhee/), titres('toux chronique').join(' | '));
  assert.ok(!contient(titres('insuffisance rénale'), /insuffisance cardiaque/), titres('insuffisance rénale').join(' | '));
  assert.ok(!contient(titres('choc anaphylactique'), /septique/), titres('choc anaphylactique').join(' | '));
});

test('abréviation reconnue : mot entier seulement (« PrEP » n’est pas « prépubère »)', () => {
  assert.ok(!contient(titres('PrEP'), /prepubere/), titres('PrEP').join(' | '));
  assert.ok(!contient(titres('C diff'), /intubation/), titres('C diff').join(' | '));
});

test('« pompe » (inhalateur) ne ramène pas les IPP en premier', () => {
  assert.match(R.normaliser(premiers('pompe asthme', 1)[0]), /asthme/);
  assert.ok(contient(titres('pompe à protons'), /pompe a protons/));
});

test('« œil rouge » ne trouve pas « Coup d’œil » ; hépatite B ne trouve pas un organisme au hasard', () => {
  assert.ok(!contient(titres('oeil rouge'), /coup d oeil|drapeaux rouges/), titres('oeil rouge').join(' | '));
  assert.ok(!contient(titres('hépatite B'), /old brewery/), titres('hépatite B').join(' | '));
});

test('noms de médicaments : Ventolin et Flovent mènent à l’asthme ou à la MPOC', () => {
  for (const q of ['ventolin', 'flovent']) assert.ok(contient(premiers(q, 3), /asthme|mpoc/), q);
});
