'use strict';

/*
 * Artefact public de production (trouvetaclinique.ca).
 * Ne s'applique pas à l'aperçu : l'aperçu a scripts/preparer-apercu.js
 * et le dépôt TrouveTaClinique/apercu.
 *
 * Copie le même ensemble public que l'aperçu, plus le sitemap, llms.txt,
 * robots.txt et le fichier de vérification Google. Aucune réécriture d'adresse,
 * aucun noindex ajouté. Le dossier scripts/ n'est pas copié.
 */

const fs = require('node:fs');
const path = require('node:path');
const { lister, RACINE, donneesPubliques } = require('./preparer-apercu.js');

const CNAME_PRODUCTION = 'trouvetaclinique.ca';
const ORIGINE = 'https://trouvetaclinique.ca';
const EXTRAS = [
  'sitemap.xml',
  'llms.txt',
  'robots.txt',
  'google0e6f553795bbb4a9.html'
];

function preparerPagesProduction(racine, destination) {
  racine = fs.realpathSync(racine);
  destination = path.resolve(destination);
  if (destination === racine || racine.startsWith(destination + path.sep)) {
    throw new Error('La destination ne peut pas écraser les sources.');
  }
  if (fs.existsSync(destination) && (fs.lstatSync(destination).isSymbolicLink() || fs.readdirSync(destination).length)) {
    throw new Error('La destination doit être un dossier vide.');
  }
  const fichiers = lister(racine).slice();
  for (const extra of EXTRAS) {
    if (fs.existsSync(path.join(racine, extra))) fichiers.push(extra);
  }
  for (const fichier of fichiers) {
    const rel = fichier.split(path.sep).join('/');
    if (/(^|\/)donnees-etablissements-source\.json$/.test(rel)) {
      throw new Error('Source de travail des établissements dans l\'artefact public.');
    }
  }
  fs.mkdirSync(destination, { recursive: true });
  for (const fichier of fichiers) {
    const sortie = path.join(destination, fichier);
    fs.mkdirSync(path.dirname(sortie), { recursive: true });
    if (fichier === 'data.json') {
      fs.writeFileSync(sortie, donneesPubliques(fs.readFileSync(path.join(racine, fichier), 'utf8')));
    } else {
      fs.copyFileSync(path.join(racine, fichier), sortie);
    }
  }
  fs.writeFileSync(path.join(destination, '.nojekyll'), '');
  fs.writeFileSync(path.join(destination, 'CNAME'), CNAME_PRODUCTION + '\n');
  return { fichiers: fichiers.length, origine: ORIGINE };
}

module.exports = { preparerPagesProduction, CNAME_PRODUCTION, ORIGINE, RACINE };

if (require.main === module) {
  const destination = process.argv[2];
  if (!destination || destination.startsWith('--')) {
    throw new Error('Usage : node scripts/preparer-pages-production.js DOSSIER_SORTIE');
  }
  console.log(JSON.stringify(preparerPagesProduction(RACINE, destination), null, 2));
}
