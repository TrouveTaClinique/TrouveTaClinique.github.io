'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { GEO_ETABLISSEMENTS_EST } = require('./geo-etablissements-est.js');

const RACINE = path.resolve(__dirname, '..');
const SOURCE = path.join(__dirname, 'donnees-etablissements-source.json');
const DATA_JSON = path.join(RACINE, 'data.json');
const SORTIE = path.join(RACINE, 'data-etablissements.json');

const SIGLES = new Set(['CLSC', 'GMF-U', 'UCDG', 'CHSLD', 'CRD', 'CH', 'GMF', 'GMF-R']);

function recapitaliserNom(nom) {
  if (!nom || typeof nom !== 'string') return nom;
  const brut = nom.trim();
  if (!brut) return brut;
  const mots = brut.toLowerCase().split(/\s+/);
  return mots.map((mot, i) => {
    const upper = mot.toUpperCase();
    if (SIGLES.has(upper)) return upper;
    if (mot.includes('-')) {
      return mot.split('-').map(part => {
        const p = part.trim();
        if (!p) return p;
        if (p.length <= 3 && /^[a-z]\.?$/i.test(p)) return p.toUpperCase().replace('.', '') + '.';
        return p.charAt(0).toUpperCase() + p.slice(1);
      }).join('-');
    }
    if (i === 0 || !['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en'].includes(mot)) {
      return mot.charAt(0).toUpperCase() + mot.slice(1);
    }
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

function construire() {
  const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const data = JSON.parse(fs.readFileSync(DATA_JSON, 'utf8'));
  const installations = [];
  const secteurs = [];

  for (const etab of source.etablissements || []) {
    const geo = GEO_ETABLISSEMENTS_EST[etab.id];
    if (!geo) throw new Error(`Coordonnées manquantes pour ${etab.id}`);
    const ref = etab.decision && etab.decision.referenceExistante;
    const owner = lireProprietaire(ref, data);

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
      secteurs.push({
        id: besoin.id,
        installationId: etab.id,
        libelle: besoin.libelleAffichage || besoin.secteur,
        secteur: besoin.secteur,
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
      nbSecteurs: secteurs.length
    },
    installations,
    secteurs
  };

  fs.writeFileSync(SORTIE, JSON.stringify(sortie, null, 2) + '\n', 'utf8');
  console.log(`Écrit ${SORTIE} — ${installations.length} installations, ${secteurs.length} secteurs.`);
}

construire();
