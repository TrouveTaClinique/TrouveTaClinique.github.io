#!/usr/bin/env node
'use strict';
/*
 * Restaure les courriels des responsables du Centre (data-etablissements-centre.json), vidés le
 * 8 oct. 2026, à partir de la version d'avant le retrait (commit f524ca5e~1 de brouillon).
 * À lancer SEULEMENT après l'accord du propriétaire pour réafficher les courriels sur la carte
 * (voir CLAUDE.md, « Réafficher les courriels sur la carte »).
 *
 *   node scripts/restaurer-courriels-centre.js              aperçu, rien n'est écrit
 *   node scripts/restaurer-courriels-centre.js --appliquer  écrit le fichier
 *   --depuis=<commit>                                       autre version de référence
 *
 * Un secteur marqué « contactMasque: true » (retrait demandé par la personne) n'est jamais restauré.
 * Seule la ligne « responsableCourriel » des secteurs concernés change : le reste du fichier garde
 * sa mise en forme. Le script n'affiche que les identifiants, jamais les adresses.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.resolve(__dirname, '..');
const FICHIER = path.join(RACINE, 'data-etablissements-centre.json');
const option = nom => (process.argv.find(a => a.startsWith(`--${nom}=`)) || '').split('=').slice(1).join('=');
const REF = option('depuis') || 'f524ca5e~1';
const APPLIQUER = process.argv.includes('--appliquer');

const ancien = JSON.parse(execFileSync('git', ['show', `${REF}:data-etablissements-centre.json`], { cwd: RACINE, encoding: 'utf8' }));
let texte = fs.readFileSync(FICHIER, 'utf8');
const actuel = JSON.parse(texte);

const restaures = [];
const ignores = [];
for (const s of actuel.secteurs) {
  const rec = s.recrutement || {};
  const avant = ((ancien.secteurs.find(x => x.id === s.id) || {}).recrutement || {}).responsableCourriel;
  if (!avant || String(rec.responsableCourriel || '').trim()) continue;
  if (rec.contactMasque === true) { ignores.push(s.id); continue; }
  const debut = texte.indexOf(`"id": "${s.id}"`);
  const ligne = texte.indexOf('"responsableCourriel": ""', debut);
  const suivant = texte.indexOf('"id": "SEC-', debut + 1);
  if (debut < 0 || ligne < 0 || (suivant > 0 && ligne > suivant)) throw new Error(`Ligne introuvable pour ${s.id}`);
  texte = texte.slice(0, ligne) + `"responsableCourriel": ${JSON.stringify(avant)}` + texte.slice(ligne + '"responsableCourriel": ""'.length);
  restaures.push(s.id);
}

JSON.parse(texte);
console.log(`Référence : ${REF}`);
console.log(`Courriels à restaurer : ${restaures.length} (${restaures.join(', ') || 'aucun'})`);
if (ignores.length) console.log(`Jamais restaurés (contactMasque) : ${ignores.join(', ')}`);
if (APPLIQUER && restaures.length) {
  fs.writeFileSync(FICHIER, texte);
  console.log('data-etablissements-centre.json mis à jour. Régénérer ensuite les pages et les cartes.');
} else if (!APPLIQUER) {
  console.log('Aperçu seulement : ajouter --appliquer pour écrire le fichier.');
}
