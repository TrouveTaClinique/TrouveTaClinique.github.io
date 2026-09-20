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
