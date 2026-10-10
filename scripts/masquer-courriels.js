'use strict';
/*
 * Retrait des courriels publiés (8 oct. 2026, « jusqu'à nouvel ordre », décision du propriétaire
 * après la demande d'une médecin dont le courriel personnel était affiché).
 *
 * Un seul filtre, appliqué à trois endroits pour qu'aucun export du classeur ne remette les
 * adresses en ligne :
 *   - generer-pages-seo.js et publier-regions.js, à la lecture des données (pages générées) ;
 *   - preparer-apercu.js et preparer-pages-production.js, sur les fichiers JSON publiés
 *     (data.json, data-etablissements*.json), que les cartes lisent dans le navigateur.
 *
 * Règles :
 *   - personneRessource contenant un courriel   → « À venir » (affiché tel quel sur la carte) ;
 *   - champ dont le nom finit par « courriel »  → vidé (responsableCourriel, evenement.courriel) ;
 *   - champ « lien » en mailto:                  → vidé (inscription par courriel d'une annonce) ;
 *   - tout autre texte (infos, etc.)             → chaque adresse remplacée par « À venir ».
 * L'adresse du site (contact@trouvetaclinique.ca) n'est jamais touchée.
 *
 * Deux interrupteurs réglés séparément (10 oct. 2026) :
 *   - PUBLIER_COURRIELS_SITE : pages générées par generer-pages-seo.js (masquerCourriels) ;
 *   - PUBLIER_COURRIELS_CARTE : JSON publiés que lisent les cartes et pages des cartes
 *     (masquerPourCarte : donneesPubliques de preparer-apercu.js, publier-regions.js).
 * Pour réafficher les courriels des responsables sur la carte, voir CLAUDE.md (« Réafficher les
 * courriels sur la carte »). Les fiches de l'Est affichent de toute façon l'adresse du CISSS.
 *
 * Contacts retirés à la demande de la personne (9 oct. 2026) : un objet qui porte
 * « contactMasque: true » (le même objet que le nom, p. ex. « recrutement » d'un secteur du
 * Centre) perd son nom, son courriel et son téléphone dans tout ce qui est publié, même si on les
 * y remet un jour. Cette règle s'applique toujours, quel que soit PUBLIER_COURRIELS ; la fiche et
 * les cartes n'affichent alors aucune ligne « Contact » pour ce secteur.
 *
 * Numéros personnels (9 oct. 2026, audit des données sensibles) : dans les textes libres
 * (« infos », etc.), tout numéro de téléphone devient « À venir », sauf la ligne principale d'une
 * clinique, écrite « Téléphone : … » ou « Téléphone de la clinique : … ». Les champs « telephone »
 * eux-mêmes (lignes d'établissement ou d'événement) et les adresses web ne sont pas touchés.
 * Pour republier ces numéros un jour : PUBLIER_TELEPHONES = true.
 */
const PUBLIER_COURRIELS_SITE = false;
const PUBLIER_COURRIELS_CARTE = false;
const PUBLIER_TELEPHONES = false;
const A_VENIR = 'À venir';
const EXEMPTES = new Set(['contact@trouvetaclinique.ca']);
const RE_COURRIEL = /(?:mailto:)?[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const CHAMPS_CONTACT = ['responsableNom', 'responsableCourriel', 'personneRessource', 'telephone'];
const RE_TELEPHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?:\s*(?:poste|p\.|ext\.?)\s*\d{1,5})?/g;
const RE_LIGNE_PRINCIPALE = /T[ée]l[ée]phone(?:\s+de\s+la\s+clinique)?\s*:\s*$/i;

function adresse(m) {
  return m.replace(/^mailto:/i, '').toLowerCase();
}

function contientCourriel(texte) {
  const trouves = String(texte).match(RE_COURRIEL) || [];
  return trouves.some(m => !EXEMPTES.has(adresse(m)));
}

function masquerTexte(texte) {
  return String(texte).replace(RE_COURRIEL, m => (EXEMPTES.has(adresse(m)) ? m : A_VENIR));
}

function masquerTelephones(texte) {
  return String(texte).replace(RE_TELEPHONE, (m, position, tout) => {
    if (/\d/.test(tout.charAt(position - 1)) || /\d/.test(tout.charAt(position + m.length))) return m;
    return RE_LIGNE_PRINCIPALE.test(tout.slice(Math.max(0, position - 40), position)) ? m : A_VENIR;
  });
}

function masquer(valeur, cle, publierCourriels) {
  if (typeof valeur === 'string') {
    if (!PUBLIER_TELEPHONES && cle !== 'telephone' && !/^\s*https?:\/\//i.test(valeur)) {
      valeur = masquerTelephones(valeur);
    }
    if (publierCourriels || !contientCourriel(valeur)) return valeur;
    if (cle === 'personneRessource') return A_VENIR;
    if (/courriel$/i.test(cle)) return '';
    if (cle === 'lien' && /^\s*mailto:/i.test(valeur)) return '';
    return masquerTexte(valeur);
  }
  if (Array.isArray(valeur)) return valeur.map(v => masquer(v, cle, publierCourriels));
  if (valeur && typeof valeur === 'object') {
    const sortie = {};
    for (const [k, v] of Object.entries(valeur)) sortie[k] = masquer(v, k, publierCourriels);
    if (sortie.contactMasque === true) {
      for (const k of CHAMPS_CONTACT) if (k in sortie) sortie[k] = typeof sortie[k] === 'string' ? '' : null;
    }
    return sortie;
  }
  return valeur;
}

/* Pages du site (generer-pages-seo.js). */
function masquerCourriels(valeur, cle = '') {
  return masquer(valeur, cle, PUBLIER_COURRIELS_SITE);
}

/* JSON publiés lus par les cartes et pages des cartes (donneesPubliques, publier-regions.js). */
function masquerPourCarte(valeur) {
  return masquer(valeur, '', PUBLIER_COURRIELS_CARTE);
}

module.exports = {
  PUBLIER_COURRIELS_SITE, PUBLIER_COURRIELS_CARTE, PUBLIER_TELEPHONES, A_VENIR, EXEMPTES, RE_COURRIEL,
  RE_TELEPHONE, CHAMPS_CONTACT, contientCourriel, masquer, masquerCourriels, masquerPourCarte, masquerTexte,
  masquerTelephones
};
