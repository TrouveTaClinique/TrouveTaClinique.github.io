'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { GEO_ETABLISSEMENTS_EST } = require('./geo-etablissements-est.js');
const { categorieActiviteDepuisSecteur } = require('./categories-activite-etablissements.js');

const RACINE = path.resolve(__dirname, '..');
const SOURCE = path.join(__dirname, 'donnees-etablissements-source.json');
const DATA_JSON = path.join(RACINE, 'data.json');
const SORTIE = path.join(RACINE, 'data-etablissements.json');

/* Noms d'affichage — table explicite, pas un algorithme. Les 22 installations du
   relevé 2027 sont une liste close ; « détention / réadaptation / dépendance » restent
   des noms communs, Hôtel-Dieu un nom propre. Toute installation absente de la table
   doit faire échouer la génération plutôt que produire une casse approximative. */
const NOMS_AFFICHAGE = {
  'INS-001': 'Hôpital Pierre-Boucher',
  'INS-002': 'Centre d\'hébergement Jeanne-Crevier',
  'INS-003': 'Centre d\'hébergement de Contrecoeur',
  'INS-004': 'CLSC de Longueuil-Ouest',
  'INS-005': 'CLSC des Seigneuries',
  'INS-020': 'CLSC Simonne-Monet-Chartrand',
  'INS-022': 'GMF-U des Montérégiennes',
  'INS-006': 'Hôpital Honoré-Mercier',
  'INS-007': 'Centre d\'hébergement de l\'Hôtel-Dieu-de-Saint-Hyacinthe',
  'INS-008': 'Centre d\'hébergement de Montarville',
  'INS-009': 'Centre d\'hébergement Marguerite-Adam',
  'INS-010': 'CLSC des Maskoutains',
  'INS-011': 'CLSC des Patriotes',
  'INS-021': 'GMF-U Richelieu-Yamaska',
  'INS-012': 'Hôtel-Dieu de Sorel',
  'INS-013': 'Centre d\'hébergement Élisabeth-Lafrance',
  'INS-014': 'Centre d\'hébergement J.-Arsène-Parenteau',
  'INS-015': 'CLSC Gaston-Bélanger',
  'INS-016': 'Centre de détention',
  'INS-017': 'Centre de réadaptation en dépendance Saint-Hyacinthe',
  'INS-019': 'Centre de réadaptation en dépendance Longueuil',
  'INS-018': 'Centre de réadaptation en dépendance Saint-Philippe'
};

function nomAffichage(etab) {
  const nom = NOMS_AFFICHAGE[etab.id];
  if (!nom) throw new Error(`Nom d'affichage manquant pour ${etab.id} (${etab.nom || '?'})`);
  return nom;
}

function normaliserType(type) {
  const t = (type || '').trim();
  if (/^hô?pital$/i.test(t)) return 'hopital';
  if (/chsld|hébergement/i.test(t)) return 'chsld';
  if (/^clsc$/i.test(t)) return 'clsc';
  if (/gmf-u/i.test(t)) return 'gmf-u';
  if (/réadaptation|crd/i.test(t)) return 'crd';
  if (/détention/i.test(t)) return 'detention';
  return t.toLowerCase().replace(/\s+/g, '-');
}

function lireProprietaire(ref, data) {
  if (!ref || !ref.collection || ref.id == null) return null;
  const liste = ref.collection === 'hopitaux' ? (data.hopitaux || []) : (data.cliniques || []);
  return liste.find(o => o.id === ref.id) || null;
}

function nombreFini(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* Une installation déjà présente dans data.json (clinique ou hôpital) doit
   réutiliser ce point : sinon la carte cliniques et la carte établissements
   dessinent le même bâtiment à deux endroits. Le guide GEO_ETABLISSEMENTS_EST
   reste la source pour les installations sans référence existante. */
function coordsPour(etab, owner) {
  if (etab.decision && etab.decision.referenceExistante && owner) {
    const lat = nombreFini(owner.lat);
    const lng = nombreFini(owner.lng);
    if (lat != null && lng != null) return { lat, lng };
  }
  const geo = GEO_ETABLISSEMENTS_EST[etab.id];
  if (!geo) throw new Error(`Coordonnées manquantes pour ${etab.id}`);
  return geo;
}

function construire() {
  const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const data = JSON.parse(fs.readFileSync(DATA_JSON, 'utf8'));
  const installations = [];
  const secteurs = [];
  const idsVus = new Set();

  for (const etab of source.etablissements || []) {
    const ref = etab.decision && etab.decision.referenceExistante;
    const owner = lireProprietaire(ref, data);
    const geo = coordsPour(etab, owner);
    idsVus.add(etab.id);

    installations.push({
      id: etab.id,
      nom: nomAffichage(etab),
      type: normaliserType(etab.type),
      territoireSource: etab.rls || '',
      missionRegionale: !!etab.missionRegionale,
      referenceExistante: ref || null,
      adresse: etab.adresse || (owner && owner.adresse) || null,
      ville: etab.ville || (owner && owner.ville) || '',
      codePostal: etab.codePostal || null,
      lat: geo.lat,
      lng: geo.lng,
      lienWeb: etab.lienWeb || (owner && owner.lienWeb) || null,
      coordonneesApproximatives: false,
      mentionPublique: (etab.decision && etab.decision.mentionPublique) || null,
      publication: { visible: true }
    });

    for (const besoin of etab.besoins || []) {
      const cat = categorieActiviteDepuisSecteur(besoin.secteur);
      secteurs.push({
        id: besoin.id,
        installationId: etab.id,
        libelle: besoin.libelleAffichage || besoin.secteur,
        secteur: besoin.secteur,
        categorieActivite: cat.id,
        abbrActivite: cat.abbr,
        activites: cat.activites.slice(),
        termesRecherche: cat.termesRecherche.slice(),
        ancre: cat.ancre,
        recrutement: {
          statutDeclare: /^actif$/i.test(besoin.statut || '') ? 'actif' : 'inactif',
          dateInformation: (source.meta && source.meta.dateDonnees) || '2026-08-28'
        },
        enseignement: besoin.enseignement || null,
        regroupe: /SAD-SIAD-SP/i.test(besoin.secteur || besoin.libelleAffichage || ''),
        validation: { etat: 'a-valider', verifieLe: null }
      });
    }
  }

  const manquants = Object.keys(NOMS_AFFICHAGE).filter(id => !idsVus.has(id));
  if (manquants.length) {
    throw new Error('Noms d\'affichage sans installation source : ' + manquants.join(', '));
  }
  if (idsVus.size !== Object.keys(NOMS_AFFICHAGE).length) {
    throw new Error(`Nombre d'installations (${idsVus.size}) ≠ table des noms (${Object.keys(NOMS_AFFICHAGE).length})`);
  }

  const sortie = {
    schemaVersion: 1,
    regionApplication: 'Est',
    cycleBesoins: '2027',
    dateSource: (source.meta && source.meta.dateDonnees) || '2026-08-28',
    meta: {
      politiqueAffichage: source.meta && source.meta.politiqueAffichage,
      statutValidation: (source.meta && source.meta.statutValidation) || 'brouillon',
      nbInstallations: installations.length,
      nbSecteurs: secteurs.length,
      categoriesActivite: require('./categories-activite-etablissements.js').CATEGORIES_ACTIVITE_ETABLISSEMENTS.map(c => ({
        id: c.id,
        abbr: c.abbr,
        libelle: c.libelle,
        libelleComplet: c.libelleComplet
      }))
    },
    installations,
    secteurs
  };

  fs.writeFileSync(SORTIE, JSON.stringify(sortie, null, 2) + '\n', 'utf8');
  console.log(`Écrit ${SORTIE} — ${installations.length} installations, ${secteurs.length} secteurs.`);
}

construire();
