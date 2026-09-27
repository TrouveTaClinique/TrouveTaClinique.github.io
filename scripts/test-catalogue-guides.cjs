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
  const FORMATS = ['guide', 'algorithme', 'patient', 'outil'];
  assert.deepEqual(guidesSeuls.filter(r => !FORMATS.includes(r.format)).map(r => r.title), [], 'champ « format » manquant ou inconnu');
  assert.ok(ressources.filter(r => r.type === 'communautaire').every(r => r.format === undefined), 'les organismes n’ont pas de format');
  const guides = fs.readFileSync(path.join(racine, 'guides/index.html'), 'utf8');
  const comm = fs.readFileSync(path.join(racine, 'guides/ressources-communautaires/index.html'), 'utf8');
  const sujets = new Set(guidesSeuls.map(r => r.cat));
  assert.equal((guides.match(/class="guides-pastille"/g) || []).length, sujets.size);
  assert.ok((comm.match(/class="guides-pastille"/g) || []).length >= 20);
  assert.ok(guides.includes('data-filtre="format"') && guides.includes('id="guides-fr"'));
  assert.ok(!comm.includes('data-filtre="format"') && !comm.includes('id="guides-fr"'));
  for (const page of [guides, comm]) {
    assert.ok(page.includes('class="guides-band guides-consultes"'));
    assert.ok(page.includes('class="btn guides-demander-ia"') && page.includes('class="btn guides-proposer-ce"'));
    assert.ok(page.includes('class="guides-partiel"'));
    assert.match(page, /data-courriel="[^"@]+@[^"]+"/);
  }
  assert.equal((guides.match(/data-format="patient"/g) || []).length, guidesSeuls.filter(r => r.format === 'patient').length);
  assert.ok(fs.existsSync(path.join(racine, 'vendor/qrcode-generator.js')) && fs.existsSync(path.join(racine, 'vendor/LICENSE-qrcode-generator.txt')));
});
