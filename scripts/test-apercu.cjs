'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const {
  preparerApercu, adapterHtml, verifierConfigurationPages, lister, RACINE, ORIGINE, ORIGINE_PROJET, CNAME_APERCU
} = require('./preparer-apercu.js');

test('Pages apercu accepte le CNAME apercu et refuse la production', () => {
  assert.equal(
    verifierConfigurationPages({ cname: null, build_type: 'workflow', html_url: ORIGINE_PROJET + '/' }),
    ORIGINE_PROJET + '/'
  );
  assert.equal(
    verifierConfigurationPages({ cname: CNAME_APERCU, build_type: 'workflow', html_url: ORIGINE + '/' }),
    ORIGINE + '/'
  );
  for (const modification of [
    { cname: 'trouvetaclinique.ca' },
    { cname: 'www.trouvetaclinique.ca' },
    { cname: 'autre.example.org' },
    { html_url: 'https://trouvetaclinique.ca/' },
    { html_url: ORIGINE + '/autre/' },
    { html_url: 'https://trouvetaclinique.github.io/' },
    { html_url: 'http://apercu.trouvetaclinique.ca/' },
    { build_type: 'legacy' }
  ]) assert.throws(() => verifierConfigurationPages({
    cname: null, build_type: 'workflow', html_url: ORIGINE_PROJET + '/', ...modification
  }));
});

test('HTML : redirections et partage restent dans le brouillon, sans analytique', () => {
  const source = '<html><head><title>Carte</title><meta name="robots" content="index,follow">' +
    '<link rel="canonical" href="https://trouvetaclinique.ca/ptem/">' +
    '<meta http-equiv="refresh" content="0; url=https://trouvetaclinique.ca/ptem/"></head>' +
    '<body><script>location.replace("https://trouvetaclinique.ca/ptem/");' +
    'var URL_APP = "https://trouvetaclinique.ca/" + "monteregie-est/";</script>' +
    '<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js"></script>' +
    '<a href="https://www.santemonteregie.qc.ca/est/">Externe</a>' +
    '<a href="https://trouvetaclinique.ca.example.org/">Autre domaine</a>' +
    '<a href="https://trouvetaclinique.github.io/monteregie-est/">Ancien aperçu</a></body></html>';
  const resultat = adapterHtml(source);
  assert.match(resultat, /noindex, nofollow, noarchive/);
  assert.match(resultat, /<title>BROUILLON \| Carte<\/title>/);
  assert.ok(resultat.includes('location.replace("' + ORIGINE + '/ptem/")'));
  assert.ok(resultat.includes('url=' + ORIGINE + '/ptem/'));
  assert.ok(resultat.includes(ORIGINE + '/monteregie-est/'));
  assert.ok(resultat.includes('https://www.santemonteregie.qc.ca/est/'));
  assert.ok(resultat.includes('https://trouvetaclinique.ca.example.org/'));
  assert.doesNotMatch(resultat, /rel="canonical"|static\.cloudflareinsights/);
  assert.doesNotMatch(resultat, /trouvetaclinique\.github\.io/);
});

test('Le site complet garde ses données, ses fonctions et les sources intactes', t => {
  const temporaire = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-apercu-test-'));
  t.after(() => fs.rmSync(temporaire, { recursive: true, force: true }));
  const destination = path.join(temporaire, 'site');
  const sources = [...lister(RACINE), 'CNAME', 'robots.txt', 'sitemap.xml'];
  const hash = fichier => createHash('sha256').update(fs.readFileSync(path.join(RACINE, fichier))).digest('hex');
  const avant = sources.map(hash);
  const bilan = preparerApercu(RACINE, destination);
  assert.deepEqual(sources.map(hash), avant);
  assert.ok(bilan.fichiers > 200);
  assert.equal(bilan.origine, ORIGINE);
  for (const fichier of ['data.json', 'leaflet.js', 'territoires-rls-est.js', 'assets/seo-pages.css']) {
    assert.deepEqual(fs.readFileSync(path.join(destination, fichier)), fs.readFileSync(path.join(RACINE, fichier)));
  }
  for (const fichier of [
    '.github', 'scripts', 'PTEM2027_v2.gs', '_apercu-accueil',
    'README.md', 'ETAT-DU-BROUILLON.md', 'sitemap.xml', 'google0e6f553795bbb4a9.html',
    'DOCUMENT_MAITRE_PTEM2027_FUSION_CLAUDE_CHATGPT.md'
  ]) assert.equal(fs.existsSync(path.join(destination, fichier)), false, fichier);
  const lire = fichier => fs.readFileSync(path.join(destination, fichier), 'utf8');
  assert.equal(lire('CNAME').trim(), CNAME_APERCU);
  assert.match(lire('robots.txt'), /^User-agent: \*\nAllow: \/\n$/);
  assert.doesNotMatch(lire('robots.txt'), /Disallow|Sitemap/i);
  for (const fichier of lister(RACINE).filter(f => f.endsWith('.html'))) {
    const html = lire(fichier);
    assert.equal((html.match(/name="robots"/g) || []).length, 1, fichier);
    assert.match(html, /noindex, nofollow, noarchive/, fichier);
    assert.doesNotMatch(html, /https?:\/\/(?:www\.)?trouvetaclinique\.ca[/"']/i, fichier);
    assert.doesNotMatch(html, /static\.cloudflareinsights\.com/, fichier);
  }
  for (const chemin of ['/', '/monteregie/', '/monteregie-est/', '/monteregie-centre/', '/monteregie-ouest/', '/ptem/', '/amp/', '/cliniques/']) {
    assert.match(lire(chemin.slice(1) + 'index.html'), /ttc-version/);
  }
  const est = lire('monteregie-est/index.html');
  assert.match(est, /scope: '\/monteregie-est\/'/);
  assert.match(est, /etablissement/);
  assert.match(est, /fetch\('\.\.\/data\.json'/);
  const manifeste = JSON.parse(lire('manifest-est.webmanifest'));
  assert.equal(manifeste.scope, '/monteregie-est/');
  assert.equal(manifeste.short_name, 'PTEM 2027');
  assert.match(lire('monteregie-est/ptem/index.html'), /PTEM 2027 en médecine familiale/);
  assert.match(lire('ptem/index.html'), new RegExp('location\\.replace\\("' + ORIGINE.replace(/\./g, '\\.') + '/monteregie-est/ptem/"\\)'));
  assert.match(lire('ptem/index.html'), /location\.hash/);
  assert.match(lire('ptem/index.html'), /location\.search/);
  assert.throws(() => preparerApercu(RACINE, destination), /vide/);
});

test('Une sortie dangereuse ou un secret manquant bloque avant toute écriture', t => {
  const temporaire = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-garde-test-'));
  t.after(() => fs.rmSync(temporaire, { recursive: true, force: true }));
  const destination = path.join(temporaire, 'site');
  assert.throws(() => preparerApercu(RACINE, RACINE), /sources/);
  assert.throws(() => preparerApercu(RACINE, destination, { nomObligatoire: true }), /secret/);
  assert.throws(() => preparerApercu(RACINE, destination, { nomProtege: 'Segoe UI' }), /Nom protégé/);
  assert.equal(fs.existsSync(destination), false);
});
