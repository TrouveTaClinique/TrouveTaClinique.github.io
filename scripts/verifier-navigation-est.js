'use strict';

const fs = require('fs');
const path = require('path');

const CLASSE_PIED = 'pied-site';
const PIED_COMMUN = new RegExp(`<footer class="${CLASSE_PIED}">[\\s\\S]*?<\\/footer>`, 'gi');
const LIEN_INTERDIT = /href="[^"]*\/?monteregie-centre\/|href="[^"]*\/?monteregie-ouest\/|href="\/monteregie\/"/g;
const CIBLES = [
  'monteregie-est/index.html',
  'monteregie-est/cliniques',
  'monteregie-est/rls',
  'monteregie-est/ptem',
  'monteregie-est/ptem-u',
  'monteregie-est/amp',
  'monteregie-est/etablissements'
];

function horsPiedCommun(html) {
  return String(html).replace(PIED_COMMUN, '');
}

function liensInterditsHorsPied(html) {
  return horsPiedCommun(html).match(LIEN_INTERDIT) || [];
}

function listerHtml(racine, relatif) {
  const abs = path.join(racine, relatif);
  if (!fs.existsSync(abs)) return [];
  const info = fs.statSync(abs);
  if (info.isFile()) return abs.endsWith('.html') ? [abs] : [];
  const sortie = [];
  for (const nom of fs.readdirSync(abs)) {
    sortie.push(...listerHtml(racine, path.join(relatif, nom)));
  }
  return sortie;
}

function verifierPagesEst(racine) {
  const fichiers = [];
  for (const cible of CIBLES) fichiers.push(...listerHtml(racine, cible));
  const fautes = [];
  for (const fichier of fichiers) {
    const html = fs.readFileSync(fichier, 'utf8');
    const liens = liensInterditsHorsPied(html);
    if (liens.length) {
      fautes.push({ fichier: path.relative(racine, fichier).split(path.sep).join('/'), liens });
    }
  }
  return fautes;
}

function rapporter(fautes) {
  if (!fautes.length) {
    console.log('Navigation Est : les liens vers Centre, Ouest ou la carte complète restent dans le pied de page commun.');
    return 0;
  }
  console.error('::error::Un lien de navigation Est vers Centre, Ouest ou la carte complète se trouve hors du pied de page commun. Publication annulée.');
  for (const faute of fautes) {
    console.error(faute.fichier + ' : ' + faute.liens.join(', '));
  }
  return 1;
}

module.exports = {
  CLASSE_PIED,
  horsPiedCommun,
  liensInterditsHorsPied,
  verifierPagesEst,
  rapporter
};

if (require.main === module) {
  const racine = path.join(__dirname, '..');
  process.exit(rapporter(verifierPagesEst(racine)));
}
