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
 * Pour republier les courriels un jour : PUBLIER_COURRIELS = true, puis régénérer.
 */
const PUBLIER_COURRIELS = false;
const A_VENIR = 'À venir';
const EXEMPTES = new Set(['contact@trouvetaclinique.ca']);
const RE_COURRIEL = /(?:mailto:)?[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

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

function masquerCourriels(valeur, cle = '') {
  if (PUBLIER_COURRIELS) return valeur;
  if (typeof valeur === 'string') {
    if (!contientCourriel(valeur)) return valeur;
    if (cle === 'personneRessource') return A_VENIR;
    if (/courriel$/i.test(cle)) return '';
    if (cle === 'lien' && /^\s*mailto:/i.test(valeur)) return '';
    return masquerTexte(valeur);
  }
  if (Array.isArray(valeur)) return valeur.map(v => masquerCourriels(v, cle));
  if (valeur && typeof valeur === 'object') {
    const sortie = {};
    for (const [k, v] of Object.entries(valeur)) sortie[k] = masquerCourriels(v, k);
    return sortie;
  }
  return valeur;
}

module.exports = { PUBLIER_COURRIELS, A_VENIR, EXEMPTES, RE_COURRIEL, contientCourriel, masquerCourriels, masquerTexte };
