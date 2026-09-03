'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { GEO_ETABLISSEMENTS_EST } = require('./geo-etablissements-est.js');
const { categorieActiviteDepuisSecteur } = require('./categories-activite-etablissements.js');

const RACINE = path.resolve(__dirname, '..');
const SOURCE = path.join(__dirname, 'donnees-etablissements-source.json');
const DATA_JSON = path.join(RACINE, 'data.json');
const SORTIE = path.join(RACINE, 'data-etablissements.json');

const SIGLES = new Set(['CLSC', 'GMF-U', 'UCDG', 'CHSLD', 'CRD', 'CH', 'GMF', 'GMF-R']);

const PETITS_MOTS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en']);
/* d' / l' : élision, pas un mot à capitaliser — « Centre d'hébergement », « de l'hôtel-Dieu ». */
const ARTICLES_ELIDES = new Set(['d', 'l']);

function capitaliserMorceau(p) {
  if (!p) return p;
  const upper = p.toUpperCase();
  if (SIGLES.has(upper)) return upper;
  if (p.length <= 3 && /^[a-z]\.?$/i.test(p)) return p.toUpperCase().replace('.', '') + '.';
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function recapitaliserNom(nom) {
  if (!nom || typeof nom !== 'string') return nom;
  const brut = nom.trim();
  if (!brut) return brut;
  const mots = brut.toLowerCase().split(/\s+/);
  return mots.map((mot, i) => {
    const upper = mot.toUpperCase();
    if (SIGLES.has(upper)) return upper;
    const elision = mot.match(/^([^'’]*)(['’])(.*)$/);
    if (elision) {
      const [, avant, apo, apres] = elision;
      const avantOut = (i > 0 && ARTICLES_ELIDES.has(avant))
        ? avant
        : (avant ? capitaliserMorceau(avant) : '');
      /* Minuscule immédiatement après l'apostrophe ; les segments suivants d'un
         composé à traits d'union gardent la capitalisation habituelle. */
      const segments = apres.split('-');
      const apresOut = segments.map((part, k) => (k === 0 ? part : capitaliserMorceau(part))).join('-');
      return avantOut + apo + apresOut;
    }
    if (mot.includes('-')) {
      return mot.split('-').map(capitaliserMorceau).join('-');
    }
    if (i === 0 || !PETITS_MOTS.has(mot)) return capitaliserMorceau(mot);
    return mot;
  }).join(' ')
    .replace(/\bHopital\b/g, 'Hôpital')
    .replace(/\bHotel-dieu\b/gi, 'Hôtel-Dieu')
    .replace(/\bReadaptation\b/g, 'Réadaptation')
    .replace(/\bDependance\b/g, 'dépendance');
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

  for (const etab of source.etablissements || []) {
    const ref = etab.decision && etab.decision.referenceExistante;
    const owner = lireProprietaire(ref, data);
    const geo = coordsPour(etab, owner);

    installations.push({
      id: etab.id,
      nom: recapitaliserNom(etab.nom),
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
