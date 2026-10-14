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

/* Carte Montérégie-Est hermétique (13 oct. 2026, choix du propriétaire) : aucun lien vers une
   autre page du site, ni dans le HTML ni dans les fiches que le JavaScript construit. Restent
   permis : liens externes, courriels (mailto:), téléphones (tel:) et liens vers la carte
   elle-même (#…). Une adresse calculée (href="${…}", x.href = variable) doit être l'une des
   formes connues ci-dessous, toutes externes : un nouveau lien calculé est à vérifier, puis à
   ajouter ici. */
const CARTE_HERMETIQUE = 'monteregie-est/';
/* 14 oct. 2026 : version autonome publiée sur une page non répertoriée, hermétique elle aussi. */
const PAGES_HERMETIQUES = Object.freeze([CARTE_HERMETIQUE, 'carte-recrutement-est/']);
const LIENS_CALCULES_EXTERNES = Object.freeze([
  '${esc(urlWebSure(h.site))}', // établissement : site web (http ou https seulement)
  '${esc(href)}',               // siteLink() : site web de la clinique (urlWebSure)
  '${url}',                     // mapsLink() : Google Maps
  '${esc(poRaw)}',              // porte ouverte : adresse https
  '${reportHref}'               // « Signaler une correction » : mailto:
]);
const ADRESSES_AFFECTEES_EXTERNES = Object.freeze([
  'lien',      // annonce : inscription (https par urlWebSure, ou mailto:)
  'lienCarte'  // annonce : itinéraire (https par urlWebSure)
]);
/* Champs des données que la carte Est transforme en liens. */
const CHAMPS_LIENS = Object.freeze({
  cliniques: ['site', 'porteOuverte'],
  hopitaux: ['site'],
  annonce: ['lien', 'lienCarte'],
  installations: ['lienWeb']
});
const ADRESSE_DU_SITE = /(?:^|[\/.])trouvetaclinique\.ca(?![\w-])/i;

/* Vrai si l'adresse mène à une autre page du site que la carte elle-même. */
function menerAuSite(href, page = CARTE_HERMETIQUE) {
  const h = String(href).trim();
  if (h.startsWith('${')) return !LIENS_CALCULES_EXTERNES.includes(h);
  let u;
  try { u = new URL(h, 'https://trouvetaclinique.ca/' + page); } catch { return true; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (!/(?:^|\.)trouvetaclinique\.ca$/i.test(u.hostname)) return false;
  return u.pathname.replace(/index\.html$/, '') !== '/' + page;
}

/* Liens de la carte Est vers le reste du site (liste vide : carte hermétique). */
function liensVersLeSite(html, page = CARTE_HERMETIQUE) {
  const texte = String(html);
  const fautes = [];
  for (const m of texte.matchAll(/<(?:a|area)\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1/gi)) {
    if (menerAuSite(m[2], page)) fautes.push(m[2]);
  }
  for (const m of texte.matchAll(/<form\b[^>]*?\baction\s*=\s*(["'])(.*?)\1/gi)) {
    if (menerAuSite(m[2], page)) fautes.push('action=' + m[2]);
  }
  for (const m of texte.matchAll(/\.href\s*=(?!=)\s*([^;\n]+)/g)) {
    const valeur = m[1].trim();
    const litteral = valeur.match(/^(["'`])(.*)\1$/);
    if (litteral ? menerAuSite(litteral[2], page) : !ADRESSES_AFFECTEES_EXTERNES.includes(valeur)) {
      fautes.push('.href = ' + valeur);
    }
  }
  for (const m of texte.matchAll(/\blocation\s*=(?!=)|\blocation\.(?:assign|replace)\s*\(|\bwindow\.open\s*\(/g)) {
    fautes.push(m[0]);
  }
  return fautes;
}

/* Adresses du site dans les champs que la carte Est transforme en liens (Est seulement). */
function adressesDuSiteDansLesDonnees(donnees, etablissements) {
  const fautes = [];
  const verifier = (objet, champs, libelle) => {
    for (const champ of champs) {
      const valeur = objet && objet[champ];
      if (typeof valeur === 'string' && ADRESSE_DU_SITE.test(valeur)) {
        fautes.push(libelle + ' : ' + champ + ' = ' + valeur);
      }
    }
  };
  const d = donnees || {};
  for (const c of d.cliniques || []) {
    if (c.region === 'Est') verifier(c, CHAMPS_LIENS.cliniques, 'clinique ' + c.id);
  }
  for (const h of d.hopitaux || []) {
    if (h.region === 'Est') verifier(h, CHAMPS_LIENS.hopitaux, 'hôpital ' + h.id);
  }
  verifier(d.annonce, CHAMPS_LIENS.annonce, 'annonce');
  for (const i of (etablissements && etablissements.installations) || []) {
    verifier(i, CHAMPS_LIENS.installations, 'installation ' + i.id);
  }
  return fautes;
}

function verifierCarteHermetique(racine) {
  const lireJson = rel => JSON.parse(fs.readFileSync(path.join(racine, rel), 'utf8'));
  const liens = [];
  for (const page of PAGES_HERMETIQUES) {
    const fichier = path.join(racine, page, 'index.html');
    if (!fs.existsSync(fichier)) continue;
    for (const faute of liensVersLeSite(fs.readFileSync(fichier, 'utf8'), page)) liens.push(page + 'index.html : ' + faute);
  }
  return [
    ...liens,
    ...adressesDuSiteDansLesDonnees(lireJson('data.json'), lireJson('data-etablissements.json'))
  ];
}

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

function rapporter(fautes, fautesCarte = []) {
  let code = 0;
  if (!fautes.length) {
    console.log('Navigation Est : les liens vers Centre, Ouest ou la carte complète restent dans le pied de page commun.');
  } else {
    console.error('::error::Un lien de navigation Est vers Centre, Ouest ou la carte complète se trouve hors du pied de page commun. Publication annulée.');
    for (const faute of fautes) {
      console.error(faute.fichier + ' : ' + faute.liens.join(', '));
    }
    code = 1;
  }
  if (!fautesCarte.length) {
    console.log('Cartes hermétiques (Montérégie-Est et version autonome) : aucun lien vers le reste du site.');
  } else {
    console.error('::error::La carte Montérégie-Est mène vers une autre page du site (carte hermétique depuis le 13 oct. 2026). Publication annulée.');
    for (const faute of fautesCarte) console.error(faute);
    code = 1;
  }
  return code;
}

module.exports = {
  CLASSE_PIED,
  CARTE_HERMETIQUE,
  PAGES_HERMETIQUES,
  horsPiedCommun,
  liensInterditsHorsPied,
  liensVersLeSite,
  adressesDuSiteDansLesDonnees,
  verifierPagesEst,
  verifierCarteHermetique,
  rapporter
};

if (require.main === module) {
  const racine = path.join(__dirname, '..');
  process.exit(rapporter(verifierPagesEst(racine), verifierCarteHermetique(racine)));
}
