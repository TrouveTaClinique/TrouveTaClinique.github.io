#!/usr/bin/env node
/**
 * Vérifie que la page PTEM-U est bien branchée dans ce dépôt.
 *
 * La page canonique vit sous /monteregie-est/ptem-u/ (comme PTEM et AMP).
 * Le sitemap, les redirections et les liens GMF-U sont produits par
 * scripts/generer-pages-seo.js — ce script ne modifie aucun fichier.
 *
 * Usage : node scripts/deployer-ptem-u.js
 */

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const URL_PAGE = 'https://trouvetaclinique.ca/monteregie-est/ptem-u/';
const INCLURE_TOUTES_REGIONS = true;

function ligne() {
  console.log('─'.repeat(72));
}

function exigence(ok, messageOk, messageErreur) {
  if (ok) {
    console.log('  ✓ ' + messageOk);
    return true;
  }
  console.error('  ✗ ' + messageErreur);
  return false;
}

function verifierSources() {
  ligne();
  console.log('1. Fichiers de la page');
  const source = path.join(RACINE, 'scripts', 'sources', 'ptem-u.html');
  const live = path.join(RACINE, 'monteregie-est', 'ptem-u', 'index.html');
  const redir = path.join(RACINE, 'ptem-u', 'index.html');
  let ok = true;
  ok = exigence(
    fs.existsSync(source),
    'scripts/sources/ptem-u.html présent',
    'scripts/sources/ptem-u.html est absent.'
  ) && ok;
  ok = exigence(
    fs.existsSync(live),
    'monteregie-est/ptem-u/index.html présent',
    'monteregie-est/ptem-u/index.html est absent. Lancer : node scripts/generer-pages-seo.js'
  ) && ok;
  ok = exigence(
    fs.existsSync(redir),
    'ptem-u/index.html (redirection) présent',
    'ptem-u/index.html est absent. Lancer : node scripts/generer-pages-seo.js'
  ) && ok;
  if (fs.existsSync(source)) {
    const contenu = fs.readFileSync(source, 'utf8');
    const nav = (contenu.match(/<nav class="ptemu-nav"[^>]*>[\s\S]*?<\/nav>/) || [])[0] || '';
    ok = exigence(
      nav && !/ptem-u/i.test(nav),
      'le menu de la page n’a pas de bouton PTEM-U',
      'la page contient encore un lien PTEM-U dans son propre menu.'
    ) && ok;
    ok = exigence(
      /name="robots"[^>]*index,follow/.test(contenu) || /content="index,follow/.test(contenu),
      'Google peut indexer la page (index,follow)',
      'la balise robots n’autorise pas l’indexation.'
    ) && ok;
    ok = exigence(
      contenu.includes(URL_PAGE),
      'adresse officielle (canonical) correcte',
      'l’adresse officielle de la page n’est pas ' + URL_PAGE
    ) && ok;
  }
  return ok;
}

function verifierSitemap() {
  ligne();
  console.log('2. sitemap.xml (lecture seule — ne pas modifier à la main)');
  const chemin = path.join(RACINE, 'sitemap.xml');
  if (!fs.existsSync(chemin)) {
    console.error('  ✗ sitemap.xml introuvable.');
    return false;
  }
  const xml = fs.readFileSync(chemin, 'utf8');
  if (!xml.includes(URL_PAGE)) {
    console.error('  ✗ l’entrée PTEM-U manque. Lancer : node scripts/generer-pages-seo.js');
    return false;
  }
  const bloc = xml.split('<url>').find(p => p.includes(URL_PAGE)) || '';
  const priorite = (bloc.match(/<priority>([^<]+)<\/priority>/) || [])[1];
  if (priorite && priorite !== '0.5') {
    console.warn('  ! priorité sitemap = ' + priorite + ' (attendu : 0.5, plus bas que PTEM/AMP).');
  }
  console.log('  ✓ déjà présent, priorité ' + (priorite || '?') + '.');
  return true;
}

function listerCliniquesGmfU() {
  ligne();
  console.log('3. Cliniques GMF-U (liens contextuels déjà ajoutés par le générateur)');
  const chemin = path.join(RACINE, 'data.json');
  if (!fs.existsSync(chemin)) {
    console.warn('  ! data.json introuvable.');
    return;
  }
  const data = JSON.parse(fs.readFileSync(chemin, 'utf8'));
  let gmfU = (data.cliniques || []).filter(c => c && c.type === 'GMF-U');
  if (!INCLURE_TOUTES_REGIONS) gmfU = gmfU.filter(c => c.region === 'Est');
  console.log('  ' + gmfU.length + ' fiche(s) type GMF-U :\n');
  for (const c of gmfU) {
    console.log(
      '  - #' + c.id + ' · ' + c.nom +
        ' — région ' + (c.region || '?') +
        ', RLS ' + (c.rls || '?')
    );
  }
}

function rappelFinal(ok) {
  ligne();
  if (!ok) {
    console.log('Des vérifications ont échoué. Relancer node scripts/generer-pages-seo.js puis ce script.');
    ligne();
    process.exit(1);
  }
  console.log('Rappels :');
  console.log('  - Le menu du haut reste à 6 liens (Accueil, Carte, Cliniques, Établissements, PTEM, AMP).');
  console.log('  - Ne pas modifier sitemap.xml à la main : le générateur l’écrase.');
  console.log('  - Publier d’abord sur la branche brouillon (aperçu), pas sur le site public.');
  ligne();
}

const ok = verifierSources() && verifierSitemap();
listerCliniquesGmfU();
rappelFinal(ok);
