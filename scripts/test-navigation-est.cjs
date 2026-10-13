'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { liensInterditsHorsPied } = require('./verifier-navigation-est.js');

const LIEN = '<a href="/monteregie-centre/">Montérégie-Centre</a>';

test('un lien autorisé dans le pied commun passe', () => {
  const html = `<main><p>Répertoire Est</p></main><footer class="pied-site"><ul><li>${LIEN}</li></ul></footer>`;
  assert.deepEqual(liensInterditsHorsPied(html), []);
});

test('le même lien hors du pied commun échoue', () => {
  const html = `<main><p>${LIEN}</p></main><footer class="pied-site"><p>Pied sans ce lien</p></footer>`;
  assert.ok(liensInterditsHorsPied(html).length > 0);
});

/* Carte Montérégie-Est hermétique (13 oct. 2026, choix du propriétaire). */
const fs = require('node:fs');
const path = require('node:path');
const {
  liensVersLeSite, adressesDuSiteDansLesDonnees, verifierCarteHermetique
} = require('./verifier-navigation-est.js');
const racine = path.join(__dirname, '..');
const lire = rel => fs.readFileSync(path.join(racine, rel), 'utf8');

test('carte Est hermétique : tout lien vers une autre page du site est refusé', () => {
  for (const href of ['rls/pierre-boucher/', '../', '/guides/', '/monteregie-est/ptem-u/',
    'https://trouvetaclinique.ca/monteregie-est/ptem/', 'https://apercu.trouvetaclinique.ca/',
    '//trouvetaclinique.ca/a-propos/', '${esc(lienInconnu)}', '/monteregie-est/${slug}/']) {
    assert.deepEqual(liensVersLeSite(`<a href="${href}">x</a>`), [href], href);
  }
  assert.equal(liensVersLeSite("<a class='x' href='/amp/'>AMP</a>").length, 1);
  assert.equal(liensVersLeSite('<form action="/recherche/"></form>').length, 1);
  assert.equal(liensVersLeSite("lien.href = '/guides/';").length, 1);
  assert.equal(liensVersLeSite('lien.href = adresseInconnue;').length, 1);
  assert.equal(liensVersLeSite("window.open('/guides/');").length, 1);
  assert.equal(liensVersLeSite("location.assign('/');").length, 1);
});

test('carte Est hermétique : liens externes, courriels, téléphones et ancres permis', () => {
  const html = [
    '<a href="https://www.santemonteregie.qc.ca/est/recrutement-medical-monteregie-est">CISSS</a>',
    '<a href="mailto:contact@trouvetaclinique.ca">Écrire</a>', '<a href="tel:4505551234">Appeler</a>',
    '<a href="#carte">Carte</a>', '<a href="?c=12">Fiche</a>',
    '<a href="https://trouvetaclinique.ca/monteregie-est/">Cette carte</a>',
    '<a href="${url}" target="_blank">Itinéraire</a>', '<a href="mailto:${esc(p)}">x</a>',
    "a.href = '#'; linkEl.href = lien; mapEl.href = lienCarte; if (x.href === y) {}",
    'window.location.reload();'
  ].join('\n');
  assert.deepEqual(liensVersLeSite(html), []);
});

test('carte Est hermétique : aucune adresse du site dans les champs transformés en liens', () => {
  const donnees = {
    annonce: { lien: 'mailto:contact@trouvetaclinique.ca', lienCarte: 'https://www.google.com/maps/dir/' },
    cliniques: [
      { id: 1, region: 'Est', site: 'trouvetaclinique.ca/monteregie-est/ptem/', porteOuverte: '' },
      { id: 2, region: 'Est', site: 'https://clinique.example.ca', porteOuverte: 'https://www.trouvetaclinique.ca/x' },
      { id: 3, region: 'Centre', site: 'https://trouvetaclinique.ca/' }
    ],
    hopitaux: [{ id: 4, region: 'Est', site: 'https://apercu.trouvetaclinique.ca/' }]
  };
  const etablissements = { installations: [{ id: 'I1', lienWeb: 'https://trouvetaclinique.ca/guides/' }] };
  assert.deepEqual(adressesDuSiteDansLesDonnees(donnees, etablissements).map(f => f.split(' : ')[0]),
    ['clinique 1', 'clinique 2', 'hôpital 4', 'installation I1']);
});

test('la carte Est publiée ne mène à aucune autre page du site, données comprises', () => {
  assert.deepEqual(verifierCarteHermetique(racine), []);
});

test('le répertoire sous la carte Est garde son texte, sans liens', () => {
  const page = lire('monteregie-est/index.html');
  const debut = page.indexOf('<section id="repertoire-territoire"');
  assert.ok(debut > 0, 'répertoire présent');
  assert.doesNotMatch(page, /<nav id="repertoire-territoire"/);
  const repertoire = page.slice(debut, page.indexOf('<script id="repertoire-aimant">', debut));
  assert.doesNotMatch(repertoire, /<a\b/);
  assert.doesNotMatch(repertoire, /repertoire-suite/);
  assert.ok((repertoire.match(/<li>/g) || []).length >= 50, 'noms des milieux listés');
  assert.match(repertoire, /<li>Hôpital Pierre-Boucher <span class="repertoire-meta">/);
});

test('la carte de toute la Montérégie garde ses liens vers le site', () => {
  const page = lire('monteregie/index.html');
  assert.match(page, /<nav id="repertoire-territoire"/);
  assert.match(page, /href="\/monteregie-est\/cliniques\/[^"]+"/);
  for (const href of ['/monteregie-est/ptem/', '/monteregie-est/amp/', '/guides/', '/monteregie-centre/']) {
    assert.ok(page.includes(`role="menuitem" href="${href}"`), href);
  }
  assert.equal(page.split('href="/monteregie-est/ptem-u/"').length - 1, 2);
});
