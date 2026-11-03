'use strict';

// Cohérence de guides/donnees.json : sujets connus, liens uniques en HTTPS, titres soignés.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { ORDRE_SUJETS } = require('./generer-guides-cliniques.cjs');

const ressources = require(path.join(__dirname, '..', 'guides', 'donnees.json'));

test('chaque ressource a un sujet de la liste ORDRE_SUJETS', () => {
  const inconnus = [...new Set(ressources.map(r => r.cat))].filter(c => !ORDRE_SUJETS.includes(c));
  assert.deepEqual(inconnus, []);
});

test('chaque sujet de ORDRE_SUJETS contient au moins une ressource', () => {
  const vides = ORDRE_SUJETS.filter(s => !ressources.some(r => r.cat === s));
  assert.deepEqual(vides, []);
});

test('liens uniques et en HTTPS', () => {
  const urls = ressources.map(r => r.url);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every(u => new URL(u).protocol === 'https:'));
});

test('titres : pas de trait d’union collé servant de séparateur, pas de tiret cadratin', () => {
  const fautifs = ressources.map(r => r.title).filter(t => /\S- |—/.test(t));
  assert.deepEqual(fautifs, []);
});

test('organismes communautaires : sujet, rubrique et moyen de contact', () => {
  const comm = ressources.filter(r => r.type === 'communautaire');
  assert.ok(comm.length > 200);
  const fautifs = comm.filter(r => r.cat !== 'Ressources communautaires' || !r.rubrique || !Array.isArray(r.rubriques) || !(r.telephone || r.url) || /^[*(]/.test(r.title));
  assert.deepEqual(fautifs.map(r => r.title), []);
  assert.ok(ressources.filter(r => r.cat === 'Ressources communautaires').every(r => r.type === 'communautaire'));
});

test('pages générées : guides et organismes séparés, onglets et filtres propres à chaque page', () => {
  const fs = require('node:fs');
  const lire = chemin => fs.readFileSync(path.join(__dirname, '..', chemin), 'utf8');
  const guides = lire('guides/index.html');
  const comm = lire('guides/ressources-communautaires/index.html');
  const nComm = ressources.filter(r => r.type === 'communautaire').length;
  const fiches = html => (html.match(/<li class="guides-resource[" ]/g) || []).length;
  assert.equal(fiches(guides), ressources.length - nComm);
  assert.equal(fiches(comm), nComm);
  assert.ok(!guides.includes('data-type="communautaire"'));
  assert.ok(guides.includes('data-filtre="category"') && comm.includes('data-filtre="ville"') && comm.includes('id="guides-hors"'));
  assert.ok(guides.includes('<a href="/guides/" aria-current="page">') && comm.includes('<a href="/guides/ressources-communautaires/" aria-current="page">'));
  assert.ok(comm.includes('data-page="communautaire"') && guides.includes('data-page="guides"'));
});

test('chaque ressource a sa date d’ajout (champ ajoute, AAAA-MM-JJ) pour « Récemment ajoutés »', () => {
  const fautifs = ressources.filter(r => !/^\d{4}-\d{2}-\d{2}$/.test(r.ajoute || '')).map(r => r.title);
  assert.deepEqual(fautifs, []);
});

test('plan Guides (24 à 30) : type de document, pastilles, filtres, actions et consultés récemment', () => {
  const fs = require('node:fs');
  const racine = path.join(__dirname, '..');
  const guidesSeuls = ressources.filter(r => r.type !== 'communautaire');
  const FORMATS = ['guide', 'algorithme', 'aide-memoire', 'patient', 'outil'];
  assert.deepEqual(guidesSeuls.filter(r => !FORMATS.includes(r.format)).map(r => r.title), [], 'champ « format » manquant ou inconnu');
  assert.ok(ressources.filter(r => r.type === 'communautaire').every(r => r.format === undefined), 'les organismes n’ont pas de format');
  const guides = fs.readFileSync(path.join(racine, 'guides/index.html'), 'utf8');
  const comm = fs.readFileSync(path.join(racine, 'guides/ressources-communautaires/index.html'), 'utf8');
  const sujets = new Set(guidesSeuls.map(r => r.cat));
  assert.equal((guides.match(/class="guides-pastille"/g) || []).length, sujets.size);
  assert.ok((comm.match(/class="guides-pastille"/g) || []).length >= 20);
  assert.ok(guides.includes('data-filtre="format"') && guides.includes('id="guides-fr"') && guides.includes('id="guides-libre"'));
  assert.equal((guides.match(/data-abo="1"/g) || []).length, ressources.filter(r => r.acces && r.type !== 'communautaire').length);
  assert.ok(!comm.includes('data-filtre="format"') && !comm.includes('id="guides-fr"') && !comm.includes('id="guides-libre"'));
  for (const page of [guides, comm]) {
    assert.ok(page.includes('class="guides-band guides-consultes"'));
    assert.ok(page.includes('class="btn guides-demander-ia"') && page.includes('class="btn guides-proposer-ce"'));
    assert.ok(page.includes('class="guides-partiel"'));
    assert.match(page, /data-courriel="[^"@]+@[^"]+"/);
  }
  assert.equal((guides.match(/data-format="patient"/g) || []).length, guidesSeuls.filter(r => r.format === 'patient').length);
  assert.ok(fs.existsSync(path.join(racine, 'vendor/qrcode-generator.js')) && fs.existsSync(path.join(racine, 'vendor/LICENSE-qrcode-generator.txt')));
});

// Olivier a confirmé l’accord de la FMPE le 31 octobre 2026 : seuls les modules
// PABP complets de MODULES_PABP_AUTORISES peuvent être hébergés. Ne pas élargir
// ces listes à d’autres fichiers protégés.
const FEUILLETS_FMPE = new Set([
  'abandon-tabac.pdf',
  'acne.pdf',
  'allergies-alimentaires-enfant.pdf',
  'constipation-enfant.pdf',
  'diabete-type-2.pdf',
  'douleurs-prurit-vulvaires.pdf',
  'dysfonction-erectile.pdf',
  'exercices-kegel.pdf',
  'insuffisance-cardiaque.pdf',
  'lombalgie-chronique.pdf',
  'osteoporose.pdf',
  'rgo-bebe.pdf',
  'risque-cardiovasculaire.pdf',
  'sante-mentale-ados.pdf',
  'soins-ongles.pdf',
  'syncope-vasovagale.pdf',
  'synovite-transitoire.pdf',
  'testosterone.pdf',
  'vaginite-chronique.pdf',
  'voyage.pdf',
  'vulvodynie.pdf'
]);
const MODULES_PABP_AUTORISES = new Set([
  'pabp-abandon-tabac.pdf',
  'pabp-acne.pdf',
  'pabp-affections-multiples.pdf',
  'pabp-allergies-alimentaires.pdf',
  'pabp-anemie.pdf',
  'pabp-apercus-pediatriques.pdf',
  'pabp-apnee-sommeil.pdf',
  'pabp-asthme-adulte.pdf',
  'pabp-asthme-enfant.pdf',
  'pabp-autisme.pdf',
  'pabp-boiterie-enfant.pdf',
  'pabp-cephalees.pdf',
  'pabp-colon-irritable.pdf',
  'pabp-commotions.pdf',
  'pabp-comportement-enfant.pdf',
  'pabp-contraception.pdf',
  'pabp-demence-parcours.pdf',
  'pabp-demence-reperage.pdf',
  'pabp-depistage-cancer.pdf',
  'pabp-diabete-type-2.pdf',
  'pabp-dyslipidemies.pdf',
  'pabp-hematurie.pdf',
  'pabp-hypertension.pdf',
  'pabp-infertilite.pdf',
  'pabp-insomnie-prise-en-charge.pdf',
  'pabp-insuffisance-cardiaque.pdf',
  'pabp-insulinotherapie.pdf',
  'pabp-integration-connaissances-2022.pdf',
  'pabp-lombalgie.pdf',
  'pabp-menopause.pdf',
  'pabp-mpoc.pdf',
  'pabp-nephropathie.pdf',
  'pabp-neuropathie.pdf',
  'pabp-nodules-thyroidiens.pdf',
  'pabp-onychopathies.pdf',
  'pabp-orl.pdf',
  'pabp-osteoporose.pdf',
  'pabp-plaies.pdf',
  'pabp-plancher-pelvien.pdf',
  'pabp-prevention-cardiovasculaire.pdf',
  'pabp-prurit.pdf',
  'pabp-retour-travail.pdf',
  'pabp-sante-bucco-dentaire.pdf',
  'pabp-sante-gynecologique.pdf',
  'pabp-sante-masculine.pdf',
  'pabp-sante-mentale-ados.pdf',
  'pabp-scpd.pdf',
  'pabp-soins-environnement.pdf',
  'pabp-soins-transgenres.pdf',
  'pabp-steatose.pdf',
  'pabp-syncope.pdf',
  'pabp-tdah-enfant.pdf',
  'pabp-thyroide.pdf',
  'pabp-toux.pdf',
  'pabp-troubles-apprentissage.pdf',
  'pabp-troubles-vulvaires.pdf'
]);

test('accès réservé affiché ; feuillets FMPE hébergés ; modules PABP autorisés le 31 oct. 2026', () => {
  const fs = require('node:fs');
  const racine = path.join(__dirname, '..');
  assert.equal(ressources.filter(r => r.acces === 'pabp').length, 0, 'aucun accès « pabp » : les modules autorisés sont hébergés, tout autre fichier protégé reste exclu');
  const page = fs.readFileSync(path.join(racine, 'guides/index.html'), 'utf8');
  const reserves = ressources.filter(r => r.acces && r.type !== 'communautaire');
  assert.ok(reserves.every(r => ['pabp', 'abonnement'].includes(r.acces)));
  assert.equal((page.match(/class="guides-acces"/g) || []).length, reserves.length);
  const locaux = ressources.filter(r => r.url.startsWith('https://trouvetaclinique.ca/guides/fmpe/'));
  const parNom = new Map(locaux.map(r => [new URL(r.url).pathname.split('/').pop(), r]));
  assert.equal(parNom.size, locaux.length, 'deux fiches pour le même PDF FMPE');
  assert.equal(parNom.size, FEUILLETS_FMPE.size + MODULES_PABP_AUTORISES.size);
  for (const [nom, r] of parNom) {
    assert.ok(FEUILLETS_FMPE.has(nom) || MODULES_PABP_AUTORISES.has(nom), 'PDF FMPE non autorisé : ' + nom);
    assert.ok(fs.existsSync(path.join(racine, 'guides', 'fmpe', nom)), r.url);
  }
  for (const nom of FEUILLETS_FMPE) assert.ok(parNom.has(nom), 'feuillet FMPE manquant : ' + nom);
  for (const nom of MODULES_PABP_AUTORISES) {
    const r = parNom.get(nom);
    assert.ok(r, 'module PABP autorisé absent : ' + nom);
    assert.equal(r.org, 'FMPE', nom);
    assert.equal(r.ajoute, '2026-10-31', nom);
    assert.match(r.title, / : .+ \(PABP\)$/, r.title);
    assert.ok(/\bPABP\b/.test(r.tags) && /\bFMPE\b/.test(r.tags), nom);
    assert.ok(r.format === 'guide' || r.format === 'outil', nom);
    assert.equal(r.acces, undefined, nom);
  }
  assert.deepEqual(ressources.filter(r => /members\.fmpe\.org|fmpe\.org\/fr\/modules/.test(r.url)).map(r => r.title), []);
});

test('aide-mémoires d’antibiotiques : doses dans la fiche, lien vers la page du guide, source INESSS d’abord', () => {
  const fs = require('node:fs');
  const aides = ressources.filter(r => r.format === 'aide-memoire');
  assert.ok(aides.length >= 20, 'au moins 20 aide-mémoires');
  for (const r of aides) {
    assert.ok(Array.isArray(r.traitement) && r.traitement.length && r.traitement.every(t => typeof t === 'string' && /\d/.test(t) || /aucun antibiotique/i.test(t)), r.title);
    assert.match(r.url, /#page=\d+$/, r.title);
    assert.ok(['INESSS', 'Hôpital Charles-Le Moyne'].includes(r.org), r.title);
    assert.match(r.title, / : anti(biotiques|viraux|viral) de 1re ligne$/, r.title);
    assert.ok(!/—/.test(r.traitement.join(' ') + (r.attention || '')), r.title);
  }
  const html = fs.readFileSync(path.join(__dirname, '..', 'guides/index.html'), 'utf8');
  assert.equal((html.match(/class="guides-aide"/g) || []).length, aides.length);
  assert.ok(html.includes('Non compliquée : nitrofurantoïne (monohydrate/macrocristaux) 100 mg PO BID × 5 jours'));
});

