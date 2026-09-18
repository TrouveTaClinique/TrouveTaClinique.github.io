#!/usr/bin/env node
'use strict';

/*
 * Prévenir Bing (et les moteurs qui suivent IndexNow : Yandex, DuckDuckGo, Ecosia)
 * que le sitemap du site public a changé.
 *
 * Soumission OBSERVABLE : le code HTTP et le corps de réponse sont journalisés.
 * Toute réponse hors 200/202 fait échouer le processus (code de sortie 1).
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
/* Pause fixe après le push, avant le POST : GitHub Pages n’est pas synchrone. */
const ATTENTE_DEPLOIEMENT_MS = 30 * 1000;

/*
 * INDEXNOW_ENABLED reste false tant que Bing répond 403 UserForbiddenToAccessSite
 * malgré un fichier clé conforme à la racine (HTTP 200, 32 octets, sans BOM).
 * Ce n’est pas un problème de fichier de clé : c’est l’autorisation clé/domaine
 * côté Bing Webmaster Tools. Remettre à true seulement après correction Bing.
 */
const INDEXNOW_ENABLED = false;

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

function messageErreurHttp(statut, corps) {
  if (statut === 403) {
    return (
      'IndexNow 403 : la clé n’est pas autorisée pour ce domaine côté Bing ' +
      '(UserForbiddenToAccessSite). Ce n’est pas un problème de fichier de clé ' +
      'à la racine du site — vérifier l’association clé/domaine dans Bing Webmaster Tools. ' +
      (corps ? 'Réponse : ' + corps : '')
    );
  }
  return (
    'IndexNow : réponse HTTP ' + statut + ' hors 200/202.' +
    (corps ? ' Corps : ' + corps : '')
  );
}

async function attendreDeploiementPublic() {
  console.log(
    'IndexNow : pause fixe de ' + (ATTENTE_DEPLOIEMENT_MS / 1000) +
    ' s avant le POST (déploiement GitHub Pages).'
  );
  await new Promise((r) => setTimeout(r, ATTENTE_DEPLOIEMENT_MS));
}

async function envoyerLot(cle, nomFichier, urlList) {
  const keyLocation = 'https://' + HOTE + '/' + nomFichier;
  const corpsJson = JSON.stringify({
    host: HOTE,
    key: cle,
    keyLocation,
    urlList
  });
  console.log('IndexNow : POST ' + POINT_D_ENTREE + ' — ' + urlList.length + ' URL');
  const reponse = await fetch(POINT_D_ENTREE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: corpsJson
  });
  let corps = '';
  try {
    corps = (await reponse.text()).trim();
  } catch (_erreur) {
    corps = '';
  }
  console.log('IndexNow : statut HTTP ' + reponse.status);
  console.log('IndexNow : corps de réponse : ' + (corps || '(vide)'));
  const accepte = reponse.status === 200 || reponse.status === 202;
  if (!accepte) {
    throw new Error(messageErreurHttp(reponse.status, corps));
  }
  console.log('IndexNow : lot accepté (' + reponse.status + ').');
}

async function principal() {
  if (!INDEXNOW_ENABLED) {
    console.log(
      'IndexNow : désactivé (INDEXNOW_ENABLED=false). ' +
      'Bing renvoie encore 403 UserForbiddenToAccessSite malgré une clé conforme ; ' +
      'aucune soumission tant que l’autorisation clé/domaine n’est pas corrigée côté Bing.'
    );
    return;
  }
  const { cle, nom } = trouverCle();
  const sitemap = fs.readFileSync(path.join(RACINE, 'sitemap.xml'), 'utf8');
  const urls = extraireUrls(sitemap);
  if (urls.length === 0) {
    console.log('IndexNow : aucune URL https://trouvetaclinique.ca dans sitemap.xml.');
    return;
  }
  console.log('IndexNow : ' + urls.length + ' URL à soumettre (hôte ' + HOTE + ').');
  await attendreDeploiementPublic();
  for (let i = 0; i < urls.length; i += TAILLE_LOT) {
    await envoyerLot(cle, nom, urls.slice(i, i + TAILLE_LOT));
  }
}

principal().catch((erreur) => {
  console.error(erreur && erreur.message ? erreur.message : erreur);
  process.exit(1);
});
