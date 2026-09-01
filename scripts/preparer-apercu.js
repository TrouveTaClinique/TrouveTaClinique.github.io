'use strict';

// Prévisualisation uniquement. Aucun fichier source et aucun réglage Pages n'est modifié.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const RACINE = path.resolve(__dirname, '..');
const DEPOT = 'TrouveTaClinique/TrouveTaClinique.github.io';
const ORIGINE = 'https://trouvetaclinique.github.io';
const DOSSIERS = new Set([
  'assets', 'vendor', 'amp', 'ptem', 'cliniques', 'rls',
  'monteregie', 'monteregie-est', 'monteregie-centre', 'monteregie-ouest'
]);
const FICHIERS = new Set([
  'index.html', '404.html', 'data.json', 'leaflet.css', 'leaflet.js',
  'territoires-monteregie.js', 'territoires-rls-est.js', 'territoires-rls-centre-ouest.js',
  'sw.js', 'manifest-est.webmanifest', 'manifest.json', 'LICENSE',
  'apple-touch-icon-180.png', 'apple-touch-icon-est.png',
  'favicon-16.png', 'favicon-32.png', 'favicon-48.png',
  'icon-192.png', 'icon-512.png', 'icon-192-maskable.png', 'icon-512-maskable.png',
  'icon-est-192.png', 'icon-est-512.png', 'icon-est-192-maskable.png', 'icon-est-512-maskable.png',
  'og-image.png', 'screenshot-carte.png', 'screenshot-comparatif.png', 'screenshot-mobile.png',
  'screenshotestmobile.png', 'screenshotestwide.png'
]);
const EXTENSIONS = new Set([
  '.html', '.css', '.js', '.json', '.webmanifest', '.png', '.jpg', '.jpeg',
  '.svg', '.webp', '.ico', '.gif', '.woff', '.woff2', '.ttf', '.pdf'
]);
const TEXTE = new Set(['.html', '.css', '.js', '.json', '.webmanifest', '.svg']);

function lister(racine, relatif = '') {
  const resultat = [];
  for (const entree of fs.readdirSync(path.join(racine, relatif), { withFileTypes: true })) {
    if (entree.name.startsWith('.')) continue;
    const fichier = path.posix.join(relatif, entree.name);
    if (!relatif && !DOSSIERS.has(entree.name) && !FICHIERS.has(entree.name)) continue;
    if (entree.isSymbolicLink()) throw new Error('Lien symbolique interdit : ' + fichier);
    if (entree.isDirectory()) resultat.push(...lister(racine, fichier));
    else if (entree.isFile() && (FICHIERS.has(fichier) || EXTENSIONS.has(path.extname(fichier)))) {
      resultat.push(fichier);
    }
  }
  return resultat.sort();
}

function adapterHtml(html) {
  return html
    .replace(/<meta\b[^>]*\bname\s*=\s*["'](?:robots|googlebot|bingbot)["'][^>]*>\s*/gi, '')
    .replace(/<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<script\b[^>]*\bsrc\s*=\s*["']https:\/\/static\.cloudflareinsights\.com\/[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/https?:\/\/(?:www\.)?trouvetaclinique\.ca(?=[/?#"'\\\s<]|$)/gi, ORIGINE)
    .replace(/<head\b[^>]*>/i, '$&\n<meta name="robots" content="noindex, nofollow, noarchive">\n<meta name="ttc-version" content="brouillon">')
    .replace(/<title>/i, '<title>BROUILLON | ');
}

function verifierConfigurationPages(pages) {
  if (pages.cname) throw new Error('Domaine personnalisé détecté. Déploiement arrêté sans modifier le domaine.');
  if (pages.build_type !== 'workflow') throw new Error('Pages doit utiliser GitHub Actions.');
  const url = new URL(pages.html_url);
  if (url.origin !== ORIGINE || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('Adresse Pages inattendue. Déploiement arrêté.');
  }
  return ORIGINE + '/';
}

async function verifierPagesEnLigne() {
  if (process.env.GITHUB_REPOSITORY !== DEPOT || process.env.GITHUB_REF !== 'refs/heads/brouillon') {
    throw new Error('Ce déploiement est réservé à la branche brouillon du dépôt autorisé.');
  }
  if (!process.env.GH_TOKEN) throw new Error('Jeton GitHub Actions manquant.');
  const reponse = await fetch('https://api.github.com/repos/' + DEPOT + '/pages', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + process.env.GH_TOKEN,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (!reponse.ok) throw new Error('Lecture des réglages Pages refusée : HTTP ' + reponse.status);
  const url = verifierConfigurationPages(await reponse.json());
  console.log('Destination vérifiée, sans domaine personnalisé : ' + url);
}

function preparerApercu(racine, destination, options = {}) {
  racine = fs.realpathSync(racine);
  destination = path.resolve(destination);
  if (destination === racine || racine.startsWith(destination + path.sep)) {
    throw new Error('La destination ne peut pas écraser les sources.');
  }
  if (fs.existsSync(destination) && (fs.lstatSync(destination).isSymbolicLink() || fs.readdirSync(destination).length)) {
    throw new Error('La destination doit être un dossier vide.');
  }
  if (options.nomObligatoire && !options.nomProtege?.trim()) {
    throw new Error('Le secret NOM_PROTEGE_SANTE_QUEBEC est manquant. Publication annulée.');
  }
  const fichiers = lister(racine);
  const contenus = [];
  const empreinte = createHash('sha256');
  for (const fichier of fichiers) {
    let contenu = fs.readFileSync(path.join(racine, fichier));
    empreinte.update(fichier).update(contenu);
    const extension = path.extname(fichier);
    if (TEXTE.has(extension)) {
      let texte = contenu.toString('utf8');
      if (options.nomProtege && texte.normalize('NFC').toLowerCase().includes(options.nomProtege.trim().normalize('NFC').toLowerCase())) {
        throw new Error('Nom protégé détecté. Publication annulée.');
      }
      if (extension === '.html') texte = adapterHtml(texte);
      if (extension === '.webmanifest' || fichier === 'manifest.json') {
        const manifeste = JSON.parse(texte);
        manifeste.name = 'BROUILLON | ' + manifeste.name;
        manifeste.short_name = 'TTC brouillon';
        texte = JSON.stringify(manifeste, null, 2) + '\n';
      }
      if (fichier === 'sw.js') texte = texte.replace("'trouve-clinique-est-'", "'trouve-clinique-est-brouillon-'");
      contenu = Buffer.from(texte);
    }
    contenus.push([fichier, contenu]);
  }
  // Validation terminée avant toute écriture. Le dossier de sortie ne contient que le site.
  fs.mkdirSync(destination, { recursive: true });
  for (const [fichier, contenu] of contenus) {
    const sortie = path.join(destination, fichier);
    fs.mkdirSync(path.dirname(sortie), { recursive: true });
    fs.writeFileSync(sortie, contenu);
  }
  fs.writeFileSync(path.join(destination, '.nojekyll'), '');
  fs.writeFileSync(path.join(destination, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  const revision = /^[a-f0-9]{40}$/.test(options.revision || '') ? options.revision : 'local';
  const bilan = { version: 'brouillon', branche: 'brouillon', revision, origine: ORIGINE, empreinteSources: empreinte.digest('hex'), fichiers: fichiers.length };
  fs.writeFileSync(path.join(destination, 'apercu-version.json'), JSON.stringify(bilan, null, 2) + '\n');
  return bilan;
}

module.exports = { preparerApercu, adapterHtml, verifierConfigurationPages, lister, RACINE, ORIGINE };

if (require.main === module) {
  (async () => {
    if (process.argv.includes('--verifier-pages')) return verifierPagesEnLigne();
    const destination = process.argv[2];
    if (!destination || destination.startsWith('--')) throw new Error('Usage : node scripts/preparer-apercu.js DOSSIER_SORTIE [--nom-obligatoire]');
    console.log(JSON.stringify(preparerApercu(RACINE, destination, {
      nomProtege: process.env.NOM_PROTEGE,
      nomObligatoire: process.argv.includes('--nom-obligatoire'),
      revision: process.env.GITHUB_SHA
    }), null, 2));
  })().catch(erreur => { console.error(erreur.message); process.exitCode = 1; });
}
