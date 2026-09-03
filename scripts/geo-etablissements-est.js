'use strict';

/** Coordonnées retenues — guide Validation Claude 2026-09-02, §16 et §22.
 *  INS-005 (Varennes) et INS-019 (Joliette) : décisions SPEC / Olivier.
 *  Pour une installation qui porte referenceExistante, construire-data-etablissements.js
 *  lit lat/lng dans data.json (le propriétaire) et n'utilise cette table qu'en repli. */
const GEO_ETABLISSEMENTS_EST = Object.freeze({
  'INS-001': { lat: 45.53781, lng: -73.45925 },
  'INS-002': { lat: 45.613575, lng: -73.452255 },
  'INS-003': { lat: 45.854819, lng: -73.243849 },
  'INS-004': { lat: 45.527516, lng: -73.483193 },
  'INS-005': { lat: 45.68248, lng: -73.43608 },
  'INS-006': { lat: 45.634864, lng: -72.959487 },
  'INS-007': { lat: 45.62557, lng: -72.95044 },
  'INS-008': { lat: 45.52169, lng: -73.34482 },
  'INS-009': { lat: 45.57194, lng: -73.20735 },
  'INS-010': { lat: 45.636887, lng: -72.959969 },
  'INS-011': { lat: 45.590953, lng: -73.199961 },
  'INS-012': { lat: 46.045277, lng: -73.095157 },
  'INS-013': { lat: 46.046002, lng: -73.108695 },
  'INS-014': { lat: 46.04638, lng: -73.11006 },
  'INS-015': { lat: 46.045153, lng: -73.093733 },
  'INS-016': { lat: 46.03026, lng: -73.07782 },
  'INS-017': { lat: 45.634373, lng: -72.965607 },
  'INS-018': { lat: 45.354144, lng: -73.477644 },
  'INS-019': { lat: 45.523361, lng: -73.495821 },
  'INS-020': { lat: 45.53628, lng: -73.45844 },
  'INS-021': { lat: 45.637442, lng: -72.959092 },
  'INS-022': { lat: 45.568534, lng: -73.447808 }
});

module.exports = { GEO_ETABLISSEMENTS_EST };
