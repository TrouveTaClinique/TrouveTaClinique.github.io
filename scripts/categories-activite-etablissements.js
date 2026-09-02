'use strict';

/** Dix catégories d'activité du classeur Nancy — GUIDE §15, SPEC §8.5. */
const CATEGORIES_ACTIVITE_ETABLISSEMENTS = [
  {
    id: 'urgence',
    abbr: 'URG',
    libelle: 'Urgence',
    libelleComplet: 'Urgence',
    ancre: 'urgence',
    activites: ['urgence'],
    termesRecherche: ['urgence', 'urgences']
  },
  {
    id: 'hospitalisation',
    abbr: 'HOSP',
    libelle: 'Hospitalisation',
    libelleComplet: 'Hospitalisation',
    ancre: 'hospitalisation',
    activites: ['hospitalisation'],
    termesRecherche: ['hospitalisation', 'hospit']
  },
  {
    id: 'ucdg',
    abbr: 'UCDG',
    libelle: 'UCDG',
    libelleComplet: 'UCDG',
    ancre: 'ucdg',
    activites: ['ucdg'],
    termesRecherche: ['ucdg']
  },
  {
    id: 'soins-intensifs',
    abbr: 'USI',
    libelle: 'Soins intensifs',
    libelleComplet: 'Soins intensifs',
    ancre: 'soins-intensifs',
    activites: ['soins-intensifs'],
    termesRecherche: ['soins intensifs', 'si', 'reanimation', 'réanimation']
  },
  {
    id: 'gmf-u',
    abbr: 'GMFU',
    libelle: 'GMF-U',
    libelleComplet: 'GMF-U',
    ancre: 'recrutement-gmf-u',
    activites: ['gmf-u', 'enseignement'],
    termesRecherche: ['gmf-u', 'gmfu', 'universitaire', 'enseignement']
  },
  {
    id: 'longue-duree',
    abbr: 'CHSLD',
    libelle: 'Longue durée',
    libelleComplet: 'Longue durée',
    ancre: 'longue-duree',
    activites: ['longue-duree'],
    termesRecherche: ['longue duree', 'longue durée', 'chsld', 'hebergement', 'hébergement']
  },
  {
    id: 'sad-siad-sp',
    abbr: 'SAD',
    libelle: 'Soins à domicile',
    libelleComplet: 'Soins à domicile, soins palliatifs et prise en charge',
    ancre: 'sad-siad-sp-prise-en-charge',
    activites: ['sad-siad-sp', 'soins-domicile'],
    termesRecherche: ['sad', 'siad', 'sp', 'pec', 'domicile', 'palliatif', 'palliatifs', 'prise en charge']
  },
  {
    id: 'obstetrique',
    abbr: 'OBST',
    libelle: 'Obstétrique',
    libelleComplet: 'Obstétrique',
    ancre: 'obstetrique',
    activites: ['obstetrique'],
    termesRecherche: ['obstetrique', 'obstétrique', 'accouchement']
  },
  {
    id: 'detention',
    abbr: 'DÉT',
    libelle: 'Centre de détention',
    libelleComplet: 'Centre de détention',
    ancre: 'medecine-en-detention',
    activites: ['detention'],
    termesRecherche: ['detention', 'détention', 'carceral', 'carceral']
  },
  {
    id: 'crd',
    abbr: 'CRD',
    libelle: 'Réadaptation',
    libelleComplet: 'Réadaptation en dépendance',
    ancre: 'dependance',
    activites: ['crd', 'readaptation', 'réadaptation'],
    termesRecherche: ['crd', 'readaptation', 'réadaptation', 'dependance', 'dépendance']
  }
];

const PAR_SECTEUR_SOURCE = new Map([
  ['Urgence', 'urgence'],
  ['Hospitalisation', 'hospitalisation'],
  ['UCDG', 'ucdg'],
  ['Soins intensifs (unité ≤ 6 lits)', 'soins-intensifs'],
  ['GMF-U', 'gmf-u'],
  ['Longue durée', 'longue-duree'],
  ['SAD-SIAD-SP (Prise en charge)', 'sad-siad-sp'],
  ['Obstétrique', 'obstetrique'],
  ['Centre de détention', 'detention'],
  ['Centre de réadaptation en dépendance (CRD)', 'crd']
]);

function categorieActiviteDepuisSecteur(secteurSource) {
  const cle = (secteurSource || '').trim();
  const id = PAR_SECTEUR_SOURCE.get(cle);
  if (!id) throw new Error(`Secteur sans categorieActivite : ${cle}`);
  return CATEGORIES_ACTIVITE_ETABLISSEMENTS.find(c => c.id === id);
}

module.exports = {
  CATEGORIES_ACTIVITE_ETABLISSEMENTS,
  PAR_SECTEUR_SOURCE,
  categorieActiviteDepuisSecteur
};
