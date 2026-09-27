'use strict';
// Correctifs de l'audit du 27 sept. 2026 sur les quatre cartes : recherche tolérante (P10), liens de sites
// en http(s) seulement (P13), contraste des chiffres blancs (P11), accord « Voir toutes les cliniques » (P08)
// et accès au clavier (P05). Les fonctions sont extraites des pages générées, telles que servies.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const racine = path.join(__dirname, '..');
const lire = p => fs.readFileSync(path.join(racine, p), 'utf8');
const CARTES = ['monteregie/index.html', 'monteregie-est/index.html', 'monteregie-centre/index.html', 'monteregie-ouest/index.html'];

// Extrait le texte source entre deux marqueurs (inclus / exclu).
const extraire = (src, debut, fin) => {
  const a = src.indexOf(debut); const b = src.indexOf(fin, a + debut.length);
  assert.ok(a >= 0 && b > a, `marqueurs introuvables : ${debut} … ${fin}`);
  return src.slice(a, b);
};
const bac = code => { const c = { String, CSS: { escape: s => s } }; vm.createContext(c); vm.runInContext(code.replace(/\b(const|let) /g, 'var '), c); return c; };

for (const carte of CARTES) {
  const src = lire(carte);

  test(`${carte} : recherche tolérante (st, ste, traits d'union, gmfu)`, () => {
    const c = bac(extraire(src, 'const normTxt', '// Un milieu'));
    const trouve = (texte, requete) => c.correspondRecherche(texte, c.normTxt(requete.trim()));
    for (const q of ['Saint-Hyacinthe', 'saint hyacinthe', 'st-hyacinthe', 'St Hyacinthe', 'SAINT-HY']) assert.ok(trouve('Saint-Hyacinthe', q), q);
    assert.ok(trouve('Sainte-Julie', 'ste-julie'));
    assert.ok(trouve('Saint-Bruno-de-Montarville', 'st-bruno'));
    assert.ok(trouve('St-Hubert', 'saint hubert'));
    for (const q of ['gmfu', 'GMF U', 'gmf-u']) assert.ok(trouve('GMF-U des Montérégiennes', q), q);
    assert.ok(trouve('Clinique L\'Émissaire', 'l emissaire'));
    assert.ok(trouve('Station santé', 'st'), 'la correspondance exacte d\'avant reste acceptée');
    assert.ok(!trouve('Varennes', 'saint'));
    assert.ok(!trouve('Longueuil', '-'));
  });

  test(`${carte} : liens de sites en http(s) seulement`, () => {
    const c = bac(extraire(src, 'function urlWebSure', 'function siteLink'));
    assert.equal(c.urlWebSure('https://www.exemple.ca/'), 'https://www.exemple.ca/');
    assert.equal(c.urlWebSure('http://exemple.ca'), 'http://exemple.ca');
    assert.equal(c.urlWebSure('www.exemple.ca'), 'https://www.exemple.ca');
    assert.equal(c.urlWebSure(' exemple.ca/equipe '), 'https://exemple.ca/equipe');
    for (const v of ['javascript:alert(1)', 'JaVaScRiPt:x', 'data:text/html,x', 'mailto:a@b.ca', 'à venir', '', null, '//evil.com', 'https://']) assert.equal(c.urlWebSure(v), '', String(v));
  });

  test(`${carte} : chiffres blancs lisibles (4,5:1) et libellé accordé`, () => {
    const table = JSON.parse(extraire(src, 'const FOND_CHIFFRE = ', ';').slice('const FOND_CHIFFRE = '.length).replace(/'/g, '"'));
    const lum = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    for (const [avant, apres] of Object.entries(table)) {
      assert.ok(1.05 / (lum(apres) + 0.05) >= 4.5, `${apres} (remplace ${avant}) : contraste insuffisant avec le blanc`);
    }
    assert.match(src, /const c = fondChiffre\(couleur\);/);
    assert.match(src, /'↩ Voir toutes les cliniques'/);
    assert.match(src, /'↩ Voir tous les secteurs'/);
    assert.doesNotMatch(src, /'↩ Voir tous les ' \+ libelleMode/);
  });

  test(`${carte} : liste et épingles utilisables au clavier`, () => {
    assert.match(src, /<span class="sb-ouvrir" role="button" tabindex="0">/);
    assert.match(src, /ouvrirParClavier\(\{ type: 'liste', id \}/);
    assert.match(src, /equiperEpingleClavier\(m, g\);/);
    assert.match(src, /rendreFocusDeclencheur\(\);\n\}/);
    assert.match(src, /\.fav-toggle:focus-visible/);
  });
}

test('générateur des pages : même règle pour les sites web', () => {
  const c = bac(extraire(lire('scripts/generer-pages-seo.js'), 'function urlWebSure', 'function rempli'));
  assert.equal(c.urlWebSure('www.exemple.ca'), 'https://www.exemple.ca');
  assert.equal(c.urlWebSure('javascript:alert(1)'), '');
  assert.equal(c.urlWebSure('https://exemple.ca'), 'https://exemple.ca');
});
