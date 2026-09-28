'use strict';
// Pages « À propos » et « Confidentialité » (28 sept. 2026) : ni nom ni courriel visibles dans le
// contenu, formulaire « Nous joindre » dont le script compile, liens discrets dans le pied de page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const racine = path.resolve(__dirname, '..');
const lire = p => fs.readFileSync(path.join(racine, p), 'utf8');
const contenu = html => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const texteVisible = html => contenu(html).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');

test('À propos et Confidentialité : ni nom ni courriel du propriétaire dans le texte', () => {
  for (const p of ['a-propos/index.html', 'confidentialite/index.html']) {
    const t = texteVisible(lire(p));
    assert.doesNotMatch(t, /Laplante|@ssss\.gouv\.qc\.ca/, p);
    assert.doesNotMatch(contenu(lire(p)), /href="mailto:/, p + ' : pas de lien mailto dans le contenu');
  }
});

test('Formulaire « Nous joindre » : champs requis et script valide', () => {
  const html = lire('a-propos/index.html');
  for (const id of ['contact-nom', 'contact-titre', 'contact-courriel', 'contact-message']) assert.match(html, new RegExp(`id="${id}"`));
  const scripts = [...contenu(html).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(scripts.length >= 1);
  for (const s of scripts) new vm.Script(s);
});

test('Pied de page commun : liens vers À propos et Confidentialité', () => {
  for (const p of ['index.html', 'monteregie-est/ptem/index.html', 'guides/index.html']) {
    const html = lire(p);
    assert.match(html, /href="\/a-propos\/"/, p);
    assert.match(html, /href="\/confidentialite\/"/, p);
  }
});
