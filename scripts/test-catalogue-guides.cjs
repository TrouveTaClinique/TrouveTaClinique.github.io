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
