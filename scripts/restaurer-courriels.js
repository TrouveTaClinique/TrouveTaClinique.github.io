#!/usr/bin/env node
'use strict';
/*
 * Remet les courriels des responsables du recrutement retirés le 8 oct. 2026, à partir de la version
 * d'avant le retrait (commit f524ca5e~1 de brouillon) :
 *   - data.json : « personneRessource » des cliniques qui valent encore « À venir » ;
 *   - data-etablissements-centre.json : « responsableCourriel » vidés des secteurs du Centre.
 * À lancer SEULEMENT après l'accord du propriétaire pour réafficher les courriels sur la carte, avec
 * PUBLIER_COURRIELS_CARTE = true (voir CLAUDE.md, « Réafficher les courriels sur la carte »).
 * Le classeur et son export (PTEM2027_v2.gs) ne servent plus depuis le 10 oct. 2026 : ce script
 * remplace l'export pour cette étape.
 *
 *   node scripts/restaurer-courriels.js              aperçu, rien n'est écrit
 *   node scripts/restaurer-courriels.js --appliquer  écrit les fichiers
 *   --depuis=<commit>                                autre version de référence
 *
 * Une fiche ou un secteur marqué « contactMasque: true » (retrait demandé par la personne) n'est
 * jamais restauré. Le script n'affiche que des identifiants, jamais d'adresses.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.resolve(__dirname, '..');
const option = nom => (process.argv.find(a => a.startsWith(`--${nom}=`)) || '').split('=').slice(1).join('=');
const REF = option('depuis') || 'f524ca5e~1';
const APPLIQUER = process.argv.includes('--appliquer');
const A_VENIR = 'À venir';

const versionAvant = fichier =>
  JSON.parse(execFileSync('git', ['show', `${REF}:${fichier}`], { cwd: RACINE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

/* data.json : réécrit au format du robot (JSON.stringify, 2 espaces), déjà celui du fichier. */
const fichierData = path.join(RACINE, 'data.json');
const donnees = JSON.parse(fs.readFileSync(fichierData, 'utf8'));
const avantData = new Map(versionAvant('data.json').cliniques.map(c => [c.id, c]));
const cliniques = [];
for (const c of donnees.cliniques) {
  if (c.contactMasque === true || String(c.personneRessource || '').trim() !== A_VENIR) continue;
  const ancien = String((avantData.get(c.id) || {}).personneRessource || '').trim();
  if (!ancien.includes('@')) continue;
  c.personneRessource = ancien;
  cliniques.push(c.id);
}

/* Centre : seule la ligne « responsableCourriel » change, le reste garde sa mise en forme. */
const fichierCentre = path.join(RACINE, 'data-etablissements-centre.json');
let texteCentre = fs.readFileSync(fichierCentre, 'utf8');
const avantCentre = versionAvant('data-etablissements-centre.json');
const secteurs = [];
const ignores = [];
for (const s of JSON.parse(texteCentre).secteurs) {
  const rec = s.recrutement || {};
  const ancien = ((avantCentre.secteurs.find(x => x.id === s.id) || {}).recrutement || {}).responsableCourriel;
  if (!ancien || String(rec.responsableCourriel || '').trim()) continue;
  if (rec.contactMasque === true) { ignores.push(s.id); continue; }
  const debut = texteCentre.indexOf(`"id": "${s.id}"`);
  const ligne = texteCentre.indexOf('"responsableCourriel": ""', debut);
  const suivant = texteCentre.indexOf('"id": "SEC-', debut + 1);
  if (debut < 0 || ligne < 0 || (suivant > 0 && ligne > suivant)) throw new Error(`Ligne introuvable pour ${s.id}`);
  texteCentre = texteCentre.slice(0, ligne) + `"responsableCourriel": ${JSON.stringify(ancien)}` +
    texteCentre.slice(ligne + '"responsableCourriel": ""'.length);
  secteurs.push(s.id);
}
JSON.parse(texteCentre);

console.log(`Référence : ${REF}`);
console.log(`data.json : ${cliniques.length} courriel(s) de cliniques à remettre${cliniques.length ? ' (fiches ' + cliniques.join(', ') + ')' : ''}`);
console.log(`Centre : ${secteurs.length} courriel(s) de secteurs à remettre (${secteurs.join(', ') || 'aucun'})`);
if (ignores.length) console.log(`Jamais restaurés (contactMasque) : ${ignores.join(', ')}`);
if (!APPLIQUER) {
  console.log('Aperçu seulement : ajouter --appliquer pour écrire les fichiers.');
} else {
  if (cliniques.length) fs.writeFileSync(fichierData, JSON.stringify(donnees, null, 2) + '\n');
  if (secteurs.length) fs.writeFileSync(fichierCentre, texteCentre);
  console.log('Fichiers mis à jour. Régénérer ensuite les pages et les cartes, puis lancer les tests.');
}
