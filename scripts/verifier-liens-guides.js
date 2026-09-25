#!/usr/bin/env node
'use strict';

// Vérifie chaque lien de guides/donnees.json et produit un rapport Markdown.
// Lancé chaque semaine par .github/workflows/verifier-liens-guides.yml, qui ouvre ou met à jour
// un ticket GitHub quand un lien est brisé, suspect ou redirigé. Lançable à la main :
//   node scripts/verifier-liens-guides.js [--rapport rapport.md]
//
// Classement de chaque lien :
//   brisé       : erreur 404, 410 ou autre erreur HTTP persistante ;
//   à vérifier  : la page répond, mais ressemble à une page d'erreur (« page introuvable »)
//                 ou renvoie vers l'accueil du site au lieu du document ;
//   redirigé    : la page répond après redirection vers une autre adresse
//                 (mettre à jour le lien dans guides/donnees.json) ;
//   bloqué      : le site refuse les robots (401, 403, 429…) : vérifier à la main au besoin ;
//   injoignable : délai dépassé ou erreur réseau, deux fois de suite ;
//   ok          : la page répond directement.
// Seuls « brisé », « à vérifier » et « redirigé » déclenchent un ticket : les sites « bloqués »
// le sont en permanence et rendraient le ticket inutile.
const fs = require('node:fs');
const path = require('node:path');

const racine = path.resolve(__dirname, '..');
const ressources = JSON.parse(fs.readFileSync(path.join(racine, 'guides/donnees.json'), 'utf8'));
const NAVIGATEUR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const DELAI = 25000;
const EN_PARALLELE = 8;
const TITRE_ERREUR = /\b(404|page introuvable|page non trouv[ée]e|introuvable|not found|page not found|n'existe plus|erreur)\b/i;
const CHEMIN_ERREUR = /(^|[/_-])(404|not-?found|page-?introuvable|erreur|error)([/._-]|$)/i;
const ACCUEIL = /^\/((fr|en)(-ca)?\/?)?(index\.html?)?$/i;

const normaliser = adresse => {
  const u = new URL(adresse);
  return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/+$/, '') + u.search).toLowerCase();
};

async function lire(url) {
  const reponse = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(DELAI),
    headers: { 'User-Agent': NAVIGATEUR, Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8', 'Accept-Language': 'fr-CA,fr;q=0.9,en;q=0.8' }
  });
  let titre = '';
  if (/html/i.test(reponse.headers.get('content-type') || '') && reponse.body) {
    /* Le début de la page suffit pour lire son titre. */
    const lecteur = reponse.body.getReader();
    let texte = '';
    const decodeur = new TextDecoder();
    while (texte.length < 200000) {
      const { done, value } = await lecteur.read();
      if (done) break;
      texte += decodeur.decode(value, { stream: true });
      if (/<\/title>/i.test(texte)) break;
    }
    lecteur.cancel().catch(() => {});
    titre = (texte.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  } else {
    reponse.body?.cancel().catch(() => {});
  }
  return { code: reponse.status, finale: reponse.url || url, titre };
}

/* Une seule visite par adresse (sans le #fragment) : les fiches qui pointent vers une page
   du même PDF, comme celles du bottin communautaire, partagent le résultat. */
const visites = new Map();
function visiter(url) {
  const cle = url.split('#')[0];
  if (!visites.has(cle)) visites.set(cle, (async () => {
    let res;
    for (let essai = 0; essai < 2; essai++) {
      try {
        res = await lire(cle);
        if (res.code < 500) break;
      } catch (e) {
        const code = e.cause?.code || '';
        res = { erreur: e.name === 'TimeoutError' ? 'délai dépassé'
          : /CERT|SIGNATURE|SSL|TLS/.test(code) ? 'certificat du site incomplet (s’ouvre souvent quand même dans un navigateur)'
          : code || e.message };
      }
      await new Promise(ok => setTimeout(ok, 5000));
    }
    return res;
  })());
  return visites.get(cle);
}

async function verifier(r) {
  const res = await visiter(r.url);
  const base = { titre: r.title, org: r.org, url: r.url };
  if (res.erreur) return { ...base, etat: 'injoignable', detail: res.erreur };
  const { code, finale, titre } = res;
  if ([401, 403, 406, 429, 999].includes(code)) return { ...base, etat: 'bloqué', detail: `HTTP ${code}` };
  if (code >= 400) return { ...base, etat: 'brisé', detail: `HTTP ${code}` };
  const depart = new URL(r.url), arrivee = new URL(finale);
  if (TITRE_ERREUR.test(titre) || CHEMIN_ERREUR.test(arrivee.pathname)) return { ...base, etat: 'à vérifier', detail: `page d’erreur probable (« ${titre || arrivee.pathname} »)`, finale };
  if (!ACCUEIL.test(depart.pathname) && ACCUEIL.test(arrivee.pathname) && !arrivee.search) return { ...base, etat: 'à vérifier', detail: 'renvoie vers l’accueil du site', finale };
  if (normaliser(finale) !== normaliser(r.url)) return { ...base, etat: 'redirigé', detail: 'nouvelle adresse', finale };
  return { ...base, etat: 'ok' };
}

async function principal() {
  const resultats = new Array(ressources.length);
  let suivant = 0;
  await Promise.all(Array.from({ length: EN_PARALLELE }, async () => {
    while (suivant < ressources.length) {
      const i = suivant++;
      resultats[i] = await verifier(ressources[i]);
    }
  }));
  const par = etat => resultats.filter(r => r.etat === etat);
  const ORDRE = ['brisé', 'à vérifier', 'redirigé', 'injoignable', 'bloqué'];
  const problemes = par('brisé').length + par('à vérifier').length + par('redirigé').length;
  const lignes = [
    `Vérification automatique des ${resultats.length} liens de \`guides/donnees.json\`, le ${new Date().toISOString().slice(0, 10)}.`,
    '',
    '| État | Nombre |', '|---|---|',
    ...['ok', ...ORDRE].map(e => `| ${e} | ${par(e).length} |`),
    ''
  ];
  for (const etat of ORDRE) {
    const liste = par(etat);
    if (!liste.length) continue;
    lignes.push(`## ${etat[0].toUpperCase() + etat.slice(1)} (${liste.length})`, '');
    if (etat === 'bloqué') lignes.push('Ces sites refusent les robots : le lien fonctionne probablement dans un navigateur.', '');
    for (const r of liste) {
      lignes.push(`- **${r.titre}** (${r.org}) : ${r.detail}  `, `  ${r.url}${r.finale ? `  \n  → ${r.finale}` : ''}`);
    }
    lignes.push('');
  }
  lignes.push('Corriger les liens dans `guides/donnees.json` (champ `url`, et `verifie` à la date du jour) : le site se régénère ensuite automatiquement.');
  const rapport = lignes.join('\n') + '\n';
  const i = process.argv.indexOf('--rapport');
  if (i > -1) fs.writeFileSync(process.argv[i + 1], rapport); else process.stdout.write(rapport);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `problemes=${problemes}\n`);
  console.error(ORDRE.concat('ok').map(e => `${e} : ${par(e).length}`).join(' · '));
}

principal().catch(e => { console.error(e); process.exit(1); });
