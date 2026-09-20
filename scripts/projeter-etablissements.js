'use strict';

/*
 * Projection publique des fichiers d'établissements.
 * =================================================
 * 19 septembre 2026.
 *
 * POURQUOI CE FICHIER EXISTE
 *   `data-etablissements.json` était servi tel quel sur le domaine public. Il portait
 *   `afficherResponsableCourriel: false` et `contactAffiche: "À venir"`, mais ses 20 adresses
 *   de responsables étaient téléchargeables en un clic, et reprises dans les `mailto:` des
 *   fiches. Masquer l'affichage ne suffisait pas : la source elle-même était publique.
 *
 * CE QUE FAIT CE MODULE
 *   Il applique la politique d'affichage PROPRE À CHAQUE FICHIER (`meta.politiqueAffichage`)
 *   et produit une copie expurgée, destinée à être la seule version déployée. Le fichier de
 *   travail complet reste hors du dépôt (voir `.gitignore`).
 *
 * RÈGLE DE PROJECTION
 *   - Les champs listés dans `meta.politiqueAffichage.champsInternes` sont retirés, à tous les
 *     niveaux d'imbrication.
 *   - Deux exceptions pilotées par leur propre indicateur :
 *       `responsableNom`      conservé si `afficherResponsableNom === true`
 *       `responsableCourriel` conservé si `afficherResponsableCourriel === true`
 *   - `etc` est retiré si `afficherETC !== true`.
 *   Pour le fichier Est, le nom reste et le courriel part. Pour le fichier Centre, qui déclare
 *   `afficherResponsableCourriel: true`, les deux restent : la publication y est conforme à sa
 *   propre politique et ne doit pas être supprimée.
 *
 * DÉGRADATION CÔTÉ CARTE
 *   Les applications cartographiques lisent `secteur.responsableCourriel` avec un repli déjà
 *   présent : sans courriel mais avec un nom, elles affichent le nom seul ; sans ni l'un ni
 *   l'autre, elles affichent « À venir ». Retirer le champ ne casse donc rien et n'exige
 *   aucune modification des gabarits de carte.
 *
 * USAGE EN LIGNE DE COMMANDE
 *   node scripts/projeter-etablissements.js <source> <sortie>
 *   node scripts/projeter-etablissements.js <source> <sortie> --empreintes scripts/empreintes-courriels-interdits.json
 *
 * La CI n'a pas le fichier privé. Les empreintes SHA-256 des courriels interdits (minuscules,
 * trim) permettent de les détecter dans les sorties sans republier les adresses. Ce n'est pas
 * une anonymisation. Recalculer les empreintes à chaque projection locale.
 */

const fs = require('node:fs');
const { createHash } = require('node:crypto');

/** Indicateur d'affichage qui gouverne un champ, quand il y en a un. */
const INDICATEUR_PAR_CHAMP = {
  responsableNom: 'afficherResponsableNom',
  responsableCourriel: 'afficherResponsableCourriel',
  etc: 'afficherETC'
};

/**
 * Résout la politique d'un fichier de données en un ensemble de champs à retirer.
 * La même résolution sert à la projection, au rendu HTML et au contrôle bloquant : c'est ce qui
 * garantit qu'ils ne peuvent pas diverger.
 */
function champsARetirer(donnees) {
  const politique = ((donnees && donnees.meta) || {}).politiqueAffichage || {};
  const internes = Array.isArray(politique.champsInternes) ? politique.champsInternes : [];
  const retirer = new Set();
  for (const champ of internes) {
    const indicateur = INDICATEUR_PAR_CHAMP[champ];
    if (indicateur && politique[indicateur] === true) continue;
    retirer.add(champ);
  }
  return retirer;
}

/** Politique effective d'un fichier, pour le rendu HTML. */
function politiqueDe(donnees) {
  return ((donnees && donnees.meta) || {}).politiqueAffichage || {};
}

/** Copie profonde en retirant les clés demandées, à tous les niveaux. */
function expurger(valeur, aRetirer) {
  if (Array.isArray(valeur)) return valeur.map(v => expurger(v, aRetirer));
  if (valeur && typeof valeur === 'object') {
    const sortie = {};
    for (const [cle, v] of Object.entries(valeur)) {
      if (aRetirer.has(cle)) continue;
      sortie[cle] = expurger(v, aRetirer);
    }
    return sortie;
  }
  return valeur;
}

/**
 * Produit la projection publique.
 * `meta.politiqueAffichage` est conservée : nommer un champ interne n'est pas une fuite, et les
 * applications cartographiques lisent cette métadonnée pour décider de leur propre affichage.
 */
function projeter(donnees) {
  const aRetirer = champsARetirer(donnees);
  const projection = expurger(donnees, aRetirer);
  if (projection && projection.meta) {
    projection.meta = Object.assign({}, projection.meta, {
      projectionPublique: true,
      champsRetires: [...aRetirer].sort()
    });
  }
  return projection;
}

/**
 * Valeurs qu'une politique interdit de publier, pour un fichier donné.
 * Sert au contrôle bloquant : on cherche ces valeurs dans les sorties déployées.
 */
function valeursInterdites(donnees) {
  const aRetirer = champsARetirer(donnees);
  const trouvees = new Map();
  (function parcourir(valeur, cheminId) {
    if (Array.isArray(valeur)) { valeur.forEach(v => parcourir(v, cheminId)); return; }
    if (!valeur || typeof valeur !== 'object') return;
    const id = valeur.id || cheminId;
    for (const [cle, v] of Object.entries(valeur)) {
      if (aRetirer.has(cle) && typeof v === 'string' && v.trim()) {
        trouvees.set(v.trim(), { champ: cle, id });
      }
      parcourir(v, id);
    }
  })(donnees, null);
  return trouvees;
}

function normaliserCourriel(adresse) {
  return String(adresse || '').trim().toLowerCase();
}

function empreinteCourriel(adresse) {
  const n = normaliserCourriel(adresse);
  if (!n) return '';
  return createHash('sha256').update(n, 'utf8').digest('hex');
}

function registreEmpreintes(donnees, contexte) {
  const aRetirer = champsARetirer(donnees);
  const empreintes = [];
  (function parcourir(valeur) {
    if (Array.isArray(valeur)) { valeur.forEach(parcourir); return; }
    if (!valeur || typeof valeur !== 'object') return;
    for (const [cle, v] of Object.entries(valeur)) {
      if (cle === 'responsableCourriel' && aRetirer.has(cle) && typeof v === 'string' && v.trim()) {
        empreintes.push(empreinteCourriel(v));
      }
      parcourir(v);
    }
  })(donnees);
  return {
    version: 1,
    contexte: contexte || 'Est',
    champ: 'responsableCourriel',
    algorithme: 'sha256-utf8-minuscules-trim',
    empreintes: [...new Set(empreintes)].sort()
  };
}

function principal() {
  const args = process.argv.slice(2);
  const source = args[0];
  const sortie = args[1];
  const idxEmp = args.indexOf('--empreintes');
  const cheminEmp = idxEmp >= 0 ? args[idxEmp + 1] : '';
  if (!source || !sortie) {
    console.error('Usage : node scripts/projeter-etablissements.js <source> <sortie> [--empreintes fichier.json]');
    process.exit(2);
  }
  const donnees = JSON.parse(fs.readFileSync(source, 'utf8'));
  const aRetirer = champsARetirer(donnees);
  const projection = projeter(donnees);
  fs.writeFileSync(sortie, JSON.stringify(projection, null, 2) + '\n', 'utf8');
  const n = valeursInterdites(donnees).size;
  console.log(`Projection écrite : ${sortie}`);
  console.log(`  champs retirés : ${aRetirer.size ? [...aRetirer].sort().join(', ') : 'aucun'}`);
  console.log(`  valeurs retirées : ${n}`);
  if (cheminEmp) {
    const registre = registreEmpreintes(donnees, 'Est');
    fs.writeFileSync(cheminEmp, JSON.stringify(registre, null, 2) + '\n', 'utf8');
    console.log(`  empreintes : ${registre.empreintes.length} (fichier ${cheminEmp})`);
  }
}

if (require.main === module) principal();

module.exports = {
  champsARetirer, politiqueDe, projeter, valeursInterdites,
  normaliserCourriel, empreinteCourriel, registreEmpreintes
};
