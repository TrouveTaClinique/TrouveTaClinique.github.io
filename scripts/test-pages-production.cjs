'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { preparerPagesProduction, CNAME_PRODUCTION, RACINE } = require('./preparer-pages-production.js');
const { verifier } = require('./verifier-fuites-etablissements.js');

test('L\'artefact de production n\'inclut pas la source de travail ni de noindex ajouté', () => {
  const temporaire = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-pages-prod-'));
  const destination = path.join(temporaire, 'site');
  try {
    const bilan = preparerPagesProduction(RACINE, destination);
    assert.ok(bilan.fichiers > 200);
    assert.equal(fs.readFileSync(path.join(destination, 'CNAME'), 'utf8').trim(), CNAME_PRODUCTION);
    assert.ok(fs.existsSync(path.join(destination, 'index.html')));
    assert.ok(fs.existsSync(path.join(destination, 'sitemap.xml')));
    assert.ok(fs.existsSync(path.join(destination, 'data-etablissements.json')));
    assert.equal(fs.existsSync(path.join(destination, 'scripts')), false);
    assert.equal(
      fs.existsSync(path.join(destination, 'scripts', 'donnees-etablissements-source.json')),
      false
    );
    const accueil = fs.readFileSync(path.join(destination, 'index.html'), 'utf8');
    assert.doesNotMatch(accueil, /noindex, nofollow, noarchive/);
    assert.doesNotMatch(accueil, /BROUILLON \|/);
    const r = verifier({ sortie: destination });
    assert.equal(r.ok, true);
    /* Les notes de travail des cliniques ne sont jamais publiées. */
    const publiees = JSON.parse(fs.readFileSync(path.join(destination, 'data.json'), 'utf8'));
    assert.ok(publiees.cliniques.length > 50);
    assert.ok(publiees.cliniques.every(c => !('notes' in c)));
    assert.ok(publiees.cliniques.every(c => Number.isFinite(c.lat) && c.nom));
  } finally {
    fs.rmSync(temporaire, { recursive: true, force: true });
  }
});
