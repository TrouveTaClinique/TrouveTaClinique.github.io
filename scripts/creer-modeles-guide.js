#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const dir = path.join(__dirname, 'sources');
fs.mkdirSync(dir, { recursive: true });

function estRedirection(html) {
  return /Page déplacée|location\.replace/.test(html);
}

function lireOriginal(nom) {
  const source = path.join(dir, nom + '.html');
  if (fs.existsSync(source)) {
    const html = fs.readFileSync(source, 'utf8');
    if (!estRedirection(html)) return html;
  }
  try {
    return execSync(`git show HEAD:${nom}/index.html`, { cwd: RACINE, encoding: 'utf8' });
  } catch {
    const legacy = path.join(RACINE, nom, 'index.html');
    const html = fs.readFileSync(legacy, 'utf8');
    if (estRedirection(html)) {
      throw new Error(`Impossible de reconstruire scripts/sources/${nom}.html : la page ${nom}/ est une redirection.`);
    }
    return html;
  }
}

const banner = `<figure class="sqb-wrap">
<a class="sqb-photo" aria-label="Ouvrir la carte interactive Montérégie-Est" href="/monteregie-est/">
<img src="{{ASSETS}}/banniere_monteregie-est.png" alt="Carte interactive Trouve ta clinique — Montérégie-Est" width="1024" height="341" loading="lazy">
</a>
</figure>`;

const navPtem = `<nav aria-label="Navigation principale" class="nav">
<a href="/">Accueil</a>
<a href="/monteregie-est/">Carte interactive</a>
<a href="/monteregie-est/cliniques/">Répertoire</a>
<a aria-current="page" href="/monteregie-est/ptem/">PTEM</a>
<a href="/monteregie-est/amp/">AMP</a>
</nav>`;

const navAmp = `<nav aria-label="Navigation principale" class="nav">
<a href="/">Accueil</a>
<a href="/monteregie-est/">Carte interactive</a>
<a href="/monteregie-est/cliniques/">Répertoire</a>
<a href="/monteregie-est/ptem/">PTEM</a>
<a aria-current="page" href="/monteregie-est/amp/">AMP</a>
</nav>`;

const footerExtra = '<p class="lien-carte-complete"><a href="/monteregie/">Carte des trois territoires</a> <span class="note-construction">(en construction)</span></p>';

function communs(html) {
  return html
    .replace(/href="\.\.\/assets\//g, 'href="{{ASSETS}}/')
    .replace(/https:\/\/trouvetaclinique\.ca\/og-image\.png\?v=2/g, 'https://trouvetaclinique.ca/assets/banniere_monteregie-est.png')
    .replace(/content="1200"/g, 'content="1024"')
    .replace(/content="630"/g, 'content="341"')
    .replace(/Carte des cliniques en recrutement de la Montérégie — Trouve ta clinique\./g, 'Carte interactive Montérégie-Est — Trouve ta clinique.')
    .replace(/<div class="site-footer__copyright">/, footerExtra + '<div class="site-footer__copyright">');
}

const ptem = communs(lireOriginal('ptem'))
  .replace(/https:\/\/trouvetaclinique\.ca\/ptem\//g, 'https://trouvetaclinique.ca/monteregie-est/ptem/')
  .replace(/<nav aria-label="Navigation principale" class="nav">[\s\S]*?<\/nav>/, navPtem)
  .replace(/<nav aria-label="Fil d’Ariane" class="breadcrumbs"><a href="\/">Accueil<\/a> › PTEM<\/nav>/,
    '<nav aria-label="Fil d’Ariane" class="breadcrumbs"><a href="/monteregie-est/">Montérégie-Est</a> › PTEM</nav>')
  .replace(/href="\/monteregie\/">Explorer la carte/g, 'href="/monteregie-est/">Explorer la carte')
  .replace(/href="\/cliniques\/">Voir les milieux publiés/g, 'href="/monteregie-est/cliniques/">Voir les milieux publiés')
  .replace(/href="\/amp\/">Comprendre les AMP/g, 'href="/monteregie-est/amp/">Comprendre les AMP')
  .replace(/href="\/cliniques\/">Comparer les milieux/g, 'href="/monteregie-est/cliniques/">Comparer les milieux')
  .replace(/href="\/monteregie\/">Ouvrir la carte/g, 'href="/monteregie-est/">Ouvrir la carte')
  .replace(/href="\/amp\/">Lire le guide AMP/g, 'href="/monteregie-est/amp/">Lire le guide AMP')
  .replace(/<figure class="sqb-wrap">[\s\S]*?<\/figure>/, banner);

const amp = communs(lireOriginal('amp'))
  .replace(/https:\/\/trouvetaclinique\.ca\/amp\//g, 'https://trouvetaclinique.ca/monteregie-est/amp/')
  .replace(/<nav aria-label="Navigation principale" class="nav">[\s\S]*?<\/nav>/, navAmp)
  .replace(/<nav aria-label="Fil d’Ariane" class="breadcrumbs"><a href="\/">Accueil<\/a> › AMP<\/nav>/,
    '<nav aria-label="Fil d’Ariane" class="breadcrumbs"><a href="/monteregie-est/">Montérégie-Est</a> › AMP</nav>')
  .replace(/href="\/monteregie\/">Explorer les milieux/g, 'href="/monteregie-est/">Explorer les milieux')
  .replace(/href="\/ptem\/">Guide PTEM/g, 'href="/monteregie-est/ptem/">Guide PTEM')
  .replace(/href="\/ptem\/">Retour au guide PTEM/g, 'href="/monteregie-est/ptem/">Retour au guide PTEM')
  .replace(/<figure class="sqb-wrap compact">[\s\S]*?<\/figure>/, banner.replace('sqb-wrap', 'sqb-wrap compact'));

fs.writeFileSync(path.join(dir, 'ptem.html'), ptem);
fs.writeFileSync(path.join(dir, 'amp.html'), amp);
console.log('Sources PTEM/AMP créées dans scripts/sources/');
