#!/usr/bin/env node
'use strict';

/*
 * Prévenir Bing (et les moteurs qui suivent IndexNow : Yandex, DuckDuckGo, Ecosia)
 * que le sitemap du site public a changé. Best-effort : une panne réseau ou un refus
 * de l'API n'arrête jamais la publication.
 *
 * Ne soumet que les adresses https://trouvetaclinique.ca/… — jamais l'aperçu.
 */

const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');
const HOTE = 'trouvetaclinique.ca';
const POINT_D_ENTREE = 'https://api.indexnow.org/indexnow';
const TAILLE_LOT = 10000;
const MOTIF_CLE = /^[a-f0-9]{32}\.txt$/i;

function trouverCle() {
  const fichiers = fs.readdirSync(RACINE).filter((nom) => MOTIF_CLE.test(nom));
  if (fichiers.length === 0) {
    throw new Error('Aucun fichier clé IndexNow (32 caractères + .txt) à la racine du dépôt.');
  }
  if (fichiers.length > 1) {
    throw new Error('Plusieurs fichiers clé IndexNow à la racine : ' + fichiers.join(', '));
  }
  const nom = fichiers[0];
  const cle = nom.replace(/\.txt$/i, '').toLowerCase();
  const contenu = fs.readFileSync(path.join(RACINE, nom), 'utf8').trim();
  if (contenu.toLowerCase() !== cle) {
    throw new Error('Le contenu de ' + nom + ' ne correspond pas au nom du fichier.');
  }
  return { cle, nom };
}

function extraireUrls(xml) {
  const urls = [];
  const vues = new Set();
  const motif = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let correspondance;
  while ((correspondance = motif.exec(xml))) {
    const brute = correspondance[1].trim();
    let adresse;
    try {
      adresse = new URL(brute);
    } catch (_erreur) {
      console.warn('IndexNow : URL du sitemap ignorée (mal formée) : ' + brute);
      continue;
    }
    if (adresse.protocol !== 'https:') continue;
    if (adresse.hostname === 'apercu.trouvetaclinique.ca') continue;
    if (adresse.hostname !== HOTE && adresse.hostname !== 'www.' + HOTE) continue;
    const canon = adresse.href;
    if (vues.has(canon)) continue;
    vues.add(canon);
    urls.push(canon);
  }
  return urls;
}

async function envoyerLot(cle, nomFichier, urlList) {
  const corps = JSON.stringify({
    host: HOTE,
    key: cle,
    keyLocation: 'https://' + HOTE + '/' + nomFichier,
    urlList
  });
  const reponse = await fetch(POINT_D_ENTREE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: corps
  });
  let extra = '';
  try {
    extra = (await reponse.text()).trim();
  } catch (_erreur) {
    extra = '';
  }
  const accepte = reponse.status === 200 || reponse.status === 202;
  console.log(
    'IndexNow : lot de ' + urlList.length + ' URL — code ' + reponse.status +
    (accepte ? ' (accepté)' : '') +
    (extra ? ' — ' + extra.slice(0, 300) : '')
  );
}

async function principal() {
  try {
    const { cle, nom } = trouverCle();
    const sitemap = fs.readFileSync(path.join(RACINE, 'sitemap.xml'), 'utf8');
    const urls = extraireUrls(sitemap);
    if (urls.length === 0) {
      console.log('IndexNow : aucune URL https://trouvetaclinique.ca dans sitemap.xml.');
      return;
    }
    console.log('IndexNow : ' + urls.length + ' URL à soumettre (hôte ' + HOTE + ').');
    for (let i = 0; i < urls.length; i += TAILLE_LOT) {
      await envoyerLot(cle, nom, urls.slice(i, i + TAILLE_LOT));
    }
  } catch (erreur) {
    console.error(
      'IndexNow : soumission non bloquante — ' +
      (erreur && erreur.message ? erreur.message : erreur)
    );
  }
}

principal();
