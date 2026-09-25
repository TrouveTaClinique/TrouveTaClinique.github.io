#!/usr/bin/env node
/*
 * deposer-ptem-u.js
 * Depot de la page « PTEM en GMF-U (PTEM-U / PREM-U) » sur trouvetaclinique.ca.
 * Prepare le 13 septembre 2026. Script autonome : aucune dependance, aucun reseau.
 *
 * ---------------------------------------------------------------------------
 * CONTEXTE (a lire si tu prends ce dossier sans historique)
 * ---------------------------------------------------------------------------
 * Depot        : TrouveTaClinique/TrouveTaClinique.github.io
 * Branche      : `brouillon` UNIQUEMENT. Tout push sur `brouillon` se deploie sur
 *                https://apercu.trouvetaclinique.ca via .github/workflows/apercu-brouillon.yml.
 *                `main` est la PRODUCTION (trouvetaclinique.ca) : ce script refuse de s'y executer.
 * Page visee   : /monteregie-est/ptem-u/ (guide du volet universitaire du PTEM, pour les
 *                residents en medecine familiale).
 *
 * Comment les pages-guides fonctionnent ici, car ce n'est pas evident :
 *   /monteregie-est/ptem/, /amp/ et /ptem-u/ ne sont PAS des fichiers statiques edites a la main.
 *   Leur source vit dans scripts/sources/<nom>.html (avec un jeton {{ASSETS}}) et c'est
 *   publierPagesGuide() dans scripts/generer-pages-seo.js qui les publie, apres passage par
 *   normaliserPageGuide() : injection du bouton hamburger, de id="site-nav", du bouton et du
 *   panneau de recherche, de assets/recherche.js, du lien « Etablissements », des metadonnees et
 *   du FAQPage JSON-LD. Editer directement monteregie-est/ptem-u/index.html serait ecrase a la
 *   prochaine generation : il faut passer par la source.
 *
 * Choix de conception a respecter :
 *   - La page est VOLONTAIREMENT absente du menu principal (qui reste a 6 liens). On y arrive
 *     par la recherche du bandeau (recherche/donnees.json), par les fiches des milieux GMF-U,
 *     et par les moteurs de recherche (la page est indexable et dans le sitemap).
 *   - Regles d'ecriture du site : aucun tiret cadratin (em dash), une phrase par ligne avec
 *     <br> dans les paragraphes narratifs, « Nouveau facturant (NF) » et non l'inverse,
 *     et « (PREM-U) » accole a chaque mention de PTEM-U.
 *   - Ce script ECRASE le contenu PTEM-U deja present sur brouillon : c'est voulu.
 *
 * ---------------------------------------------------------------------------
 * UTILISATION
 * ---------------------------------------------------------------------------
 *   git clone https://github.com/TrouveTaClinique/TrouveTaClinique.github.io.git
 *   cd TrouveTaClinique.github.io
 *   git fetch origin brouillon && git checkout brouillon
 *   (deposer ce fichier dans scripts/)
 *   node scripts/deposer-ptem-u.js                    # prepare et verifie, sans toucher a git
 *   node scripts/deposer-ptem-u.js --commit           # + git add et git commit
 *   node scripts/deposer-ptem-u.js --commit --push    # + git push  -> apercu.trouvetaclinique.ca
 *
 * ---------------------------------------------------------------------------
 * CE QUE LE SCRIPT FAIT, de facon idempotente (relancable sans degat)
 * ---------------------------------------------------------------------------
 *   1.  Ecrit scripts/sources/ptem-u.html (contenu complet de la page).
 *   1b. Pose dans scripts/sources/ptem.html un lien vers la page PTEM-U, ou complete le libelle
 *       d'un lien deja present pour qu'il porte « PTEM-U (PREM-U) ».
 *   2.  Applique a scripts/generer-pages-seo.js ce qui manque : description, FAQPage, entree
 *       sitemap, entree dans l'index de recherche, publication de la 3e page-guide, liens
 *       contextuels sur les milieux GMF-U. Si une partie du cablage existe deja sous une autre
 *       forme, elle est RESPECTEE et non dupliquee (le script detecte les constantes deja
 *       declarees et les entrees deja presentes).
 *   3.  Lance node scripts/generer-pages-seo.js.
 *   4.  Passe 13 controles sur le resultat reel et s'arrete si l'un echoue.
 *   5.  Affiche les fichiers touches.
 *   6.  Affiche les commandes git, ou les execute avec --commit / --push.
 *
 * CE QU'IL NE FAIT PAS : aucun ajout au menu de navigation, aucune ecriture sur main, aucun
 * appel reseau, aucune suppression de fichier.
 *
 * En cas d'arret : rien n'est pousse, et le generateur n'est reecrit que si les 14 modifications
 * ont pu etre resolues. Un `git diff` puis un `git checkout -- .` remet le depot en etat.
 */

'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const RACINE = process.cwd();
const CHEMIN_SOURCE = path.join(RACINE, 'scripts', 'sources', 'ptem-u.html');
const CHEMIN_GEN = path.join(RACINE, 'scripts', 'generer-pages-seo.js');
const ARGS = process.argv.slice(2);
const COMMIT = ARGS.includes('--commit');
const PUSH = ARGS.includes('--push');
const FORCE_MAIN = ARGS.includes('--force-main');

function titre(t) { console.log('\n' + t + '\n' + '-'.repeat(t.length)); }
function stop(msg) { console.error('\nARRÊT : ' + msg); process.exit(1); }

/* ---------- Garde-fous ---------- */
titre('0. Vérifications');
if (!fs.existsSync(CHEMIN_GEN) || !fs.existsSync(path.join(RACINE, 'data.json'))) {
  stop('lancer ce script depuis la racine du dépôt (data.json et scripts/generer-pages-seo.js introuvables).');
}
let branche = '';
try { branche = cp.execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim(); } catch (e) { branche = '(inconnue)'; }
console.log('  Branche courante : ' + branche);
if (branche === 'main' && !FORCE_MAIN) {
  stop('branche `main` = PRODUCTION (trouvetaclinique.ca).\n' +
       '        Passer sur la branche d\'aperçu :\n' +
       '          git fetch origin brouillon && git checkout brouillon\n' +
       '        puis relancer. (--force-main existe, mais ne sert que si Olivier l\'a demandé.)');
}
if (branche !== 'brouillon' && branche !== 'main') {
  console.log('  Attention : la branche attendue est `brouillon` (celle qui alimente apercu.trouvetaclinique.ca).');
}

/* ---------- 1. Source de la page ---------- */
const PAGE_SOURCE = `<!DOCTYPE html>

<html lang="fr-CA">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1" name="viewport"/>
<title>PTEM-U (PREM-U) : le PTEM en GMF-U | Trouve ta clinique</title>
<meta content="PTEM-U (PREM-U), le PTEM en GMF-U : place réservée aux besoins universitaires, recrutement en surplus, statuts NF et MIR, confirmation du 15 décembre et dépôt de la candidature." name="description"/>
<link href="https://trouvetaclinique.ca/monteregie-est/ptem-u/" rel="canonical"/>
<meta content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" name="robots"/>
<meta content="fr_CA" property="og:locale"/>
<meta content="website" property="og:type"/>
<meta content="Trouve ta clinique" property="og:site_name"/>
<meta content="PTEM-U (PREM-U) : le PTEM en GMF-U | Trouve ta clinique" property="og:title"/>
<meta content="PTEM-U (PREM-U), le PTEM en GMF-U : place réservée aux besoins universitaires, recrutement en surplus, statuts NF et MIR, confirmation du 15 décembre et dépôt de la candidature." property="og:description"/>
<meta content="https://trouvetaclinique.ca/monteregie-est/ptem-u/" property="og:url"/>
<meta content="summary_large_image" name="twitter:card"/>
<meta content="PTEM-U (PREM-U), le PTEM en GMF-U : place réservée aux besoins universitaires, recrutement en surplus, statuts NF et MIR, confirmation du 15 décembre et dépôt de la candidature." name="twitter:description"/>
<meta content="https://trouvetaclinique.ca/assets/banniere_monteregie-est.jpg" property="og:image"/>
<meta content="1024" property="og:image:width"/>
<meta content="341" property="og:image:height"/>
<meta content="Carte interactive Montérégie-Est · Trouve ta clinique." property="og:image:alt"/>
<meta content="https://trouvetaclinique.ca/assets/banniere_monteregie-est.jpg" name="twitter:image"/>
<link href="/favicon-32.png" rel="icon" sizes="32x32" type="image/png"/>
<link href="/favicon-16.png" rel="icon" sizes="16x16" type="image/png"/>
<link href="/favicon-48.png" rel="icon" sizes="48x48" type="image/png"/>
<link href="/apple-touch-icon-180.png" rel="apple-touch-icon"/>
<link href="{{ASSETS}}/seo-pages.css" rel="stylesheet"/>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://trouvetaclinique.ca/monteregie-est/ptem-u/#webpage",
      "url": "https://trouvetaclinique.ca/monteregie-est/ptem-u/",
      "name": "PTEM-U (PREM-U) : le PTEM en GMF-U | Trouve ta clinique",
      "description": "PTEM-U (PREM-U), le PTEM en GMF-U : place réservée aux besoins universitaires, recrutement en surplus, statuts NF et MIR, confirmation du 15 décembre et dépôt de la candidature.",
      "inLanguage": "fr-CA",
      "dateModified": "2026-09-13",
      "isPartOf": {
        "@id": "https://trouvetaclinique.ca/#website"
      }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Accueil",
          "item": "https://trouvetaclinique.ca/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "PTEM",
          "item": "https://trouvetaclinique.ca/monteregie-est/ptem/"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "PTEM en GMF-U (PTEM-U / PREM-U)",
          "item": "https://trouvetaclinique.ca/monteregie-est/ptem-u/"
        }
      ]
    }
  ]
}
</script>
</head>
<body>
<a class="skip-link" href="#contenu">Aller au contenu</a>
<header class="site-header">
<div class="site-header__inner">
<a class="brand" href="/">
<span class="logo-img" role="img" aria-label="Logo Trouve ta clinique"></span>
<span class="brand-name">Trouve ta clinique</span>
</a>
<nav aria-label="Navigation principale" class="nav">
<a href="/">Accueil</a>
<a href="/monteregie-est/">Carte interactive</a>
<a href="/monteregie-est/cliniques/">Cliniques</a>
<a href="/monteregie-est/ptem/">PTEM</a>
<a href="/monteregie-est/amp/">AMP</a>
</nav>
</div>
</header>
<main id="contenu">
<nav aria-label="Fil d’Ariane" class="breadcrumbs"><a href="/monteregie-est/">Montérégie-Est</a> › <a href="/monteregie-est/ptem/">PTEM</a> › PTEM en GMF-U</nav>
<section class="hero hero-guide">
<div class="status-line"><span class="status-badge status-ok">Volet universitaire du PTEM</span><span class="status-note">Mise à jour factuelle : 13 septembre 2026</span></div>
<p class="eyebrow">Médecine familiale · GMF-U · Québec</p>
<h1>PTEM-U (PREM-U) : le PTEM en GMF-U</h1>
<p class="lead">Le PTEM-U (PREM-U) est le volet universitaire du plan territorial des effectifs médicaux : il encadre le recrutement des médecins dans les <strong>groupes de médecine de famille universitaires</strong>.<br>Deux modes de recrutement sont prévus : une <strong>place réservée aux besoins universitaires</strong> et un <strong>recrutement en surplus de la cible régionale</strong>.<br>Les conditions diffèrent selon le mode.</p>
<p class="lead lead-small">Cette page s’adresse aux <strong>résidents en médecine familiale</strong>.<br>Elle distingue ce qui est <strong>propre au volet universitaire</strong> (sélection par la faculté, confirmation du 15 décembre) de ce qui relève du <strong>cycle PTEM général</strong> et s’applique aussi à une candidature en GMF-U : dépôt de la demande, dates et délais de réponse.</p>
<div class="inline-sources"><a class="source-chip" href="https://publications.msss.gouv.qc.ca/msss/fichiers/sante-quebec/25-Guide_gestion_PTEM.pdf" rel="noopener">Santé Québec · Guide de gestion des PTEM</a><a class="source-chip" href="https://fmrq.qc.ca/postes-pem-ptem/medecine-familiale/ptem-en-gmf-u/" rel="noopener">FMRQ · PTEM en GMF-U</a><a class="source-chip" href="https://www.ramq.gouv.qc.ca/fr/professionnels/actualites/2026-07-24/modifications-temporaires-a-ep-prem" rel="noopener">RAMQ · Accord 820 / PTEM 2027</a></div>
<div class="cta-row"><a class="button primary" href="/monteregie-est/ptem/">Guide PTEM complet</a><a class="button secondary" href="/monteregie-est/cliniques/">Voir les milieux publiés</a><a class="button ghost" href="/monteregie-est/amp/">Comprendre les AMP</a></div>
</section>
<div aria-label="Repères du PTEM en GMF-U" class="fact-grid">
<article class="fact-card"><span class="fact-kicker">Propre au volet universitaire</span><strong>15 décembre</strong><span>Date limite pour que le directeur du département de médecine de famille confirme son choix à Santé Québec et au DTMF.</span><a class="source-chip" href="https://publications.msss.gouv.qc.ca/msss/fichiers/sante-quebec/25-Guide_gestion_PTEM.pdf" rel="noopener">Santé Québec</a></article>
<article class="fact-card"><span class="fact-kicker">Propre au volet universitaire</span><strong>Place non pourvue</strong><span>Une place réservée sans candidature confirmée est retournée à la marge régionale.</span><a class="source-chip" href="https://fmrq.qc.ca/postes-pem-ptem/medecine-familiale/ptem-en-gmf-u/" rel="noopener">FMRQ</a></article>
<article class="fact-card"><span class="fact-kicker">Cycle PTEM général</span><strong>1–15 déc. 2026</strong><span>Période initiale de dépôt.<br>Le candidat en GMF-U dépose la demande d’avis de conformité habituelle.</span><a class="source-chip" href="https://www.ramq.gouv.qc.ca/fr/professionnels/actualites/2026-07-24/modifications-temporaires-a-ep-prem" rel="noopener">RAMQ</a></article>
<article class="fact-card"><span class="fact-kicker">Statut d’un finissant</span><strong>Nouveau facturant (NF)</strong><span>Moins de 200 jours facturés d’au moins 500 $ par jour.</span><a class="source-chip" href="https://publications.msss.gouv.qc.ca/msss/fichiers/sante-quebec/25-Guide_gestion_PTEM.pdf" rel="noopener">Santé Québec</a></article>
</div>
<figure class="sqb-wrap">
<a class="sqb-photo" aria-label="Ouvrir la carte interactive Montérégie-Est" href="/monteregie-est/">
<img src="{{ASSETS}}/banniere-cellulaire-monteregie-est.jpg" alt="Carte interactive Trouve ta clinique · Montérégie-Est" width="1774" height="887" decoding="sync" loading="lazy">
</a>
</figure>
<nav aria-label="Sommaire" class="toc toc-accent"><strong>Sur cette page</strong><ul>
<li><a href="#definition">Qu’est-ce que le PTEM en GMF-U?</a></li><li><a href="#modes">Les deux modes de recrutement</a></li><li><a href="#resident">Un résident finissant est-il admissible?</a></li><li><a href="#statuts">Nouveau facturant ou mobilité interrégionale</a></li><li><a href="#surplus">Conditions du recrutement en surplus</a></li><li><a href="#candidature">Comment déposer sa candidature</a></li><li><a href="#dates">Dates applicables</a></li><li><a href="#traitement">Traitement d’une candidature en GMF-U</a></li><li><a href="#delais">Délais de réponse et d’installation</a></li><li><a href="#apres">Règles applicables après le recrutement</a></li><li><a href="#milieux">GMF-U de la Montérégie</a></li><li><a href="#sources">Sources vérifiées</a></li></ul></nav>
<section class="content-section" id="definition">
<p class="section-number">01</p><h2>Qu’est-ce que le PTEM en GMF-U?</h2>
<p>Le PTEM en GMF-U fait partie du <strong>plan territorial des effectifs médicaux</strong>.<br>Il prévoit des règles particulières pour le recrutement de médecins dans les groupes de médecine de famille universitaires.</p>
<p>Les appellations varient.<br>« <strong>PTEM-U</strong> » et « <strong>PREM-U</strong> » sont d’usage courant; les documents officiels emploient « <strong>PTEM en GMF-U</strong> » et « besoins universitaires ».<br>PTEM est l’appellation actuelle de ce qui était auparavant appelé PREM : les deux désignent la même réalité administrative, et la FMRQ publie encore sa page sous l’intitulé « PREM en GMF-U ».</p>
<p>Les règles générales du PTEM (avis de conformité, portée territoriale, règle du 55 %, calendrier du cycle) sont détaillées dans le guide PTEM.</p>
<p><a class="text-cta" href="/monteregie-est/ptem/">Lire le guide PTEM complet →</a></p>
<p class="source-row"><a class="source-chip" href="https://fmrq.qc.ca/postes-pem-ptem/medecine-familiale/ptem-en-gmf-u/" rel="noopener">FMRQ · PTEM en GMF-U</a><a class="source-chip" href="https://www.quebec.ca/gouvernement/travailler-gouvernement/sante-services-sociaux/travailler-comme-medecin-famille-quebec/plans-regionaux-effectifs-medicaux-medecine-famille" rel="noopener">Québec.ca · principes des PTEM</a></p>
</section>
<section class="content-section feature-section" id="modes">
<p class="section-number">02</p><h2>Quels sont les deux modes de recrutement?</h2>
<div class="split-card">
<div><h3>Place réservée aux besoins universitaires</h3><ul class="check-list"><li>La place est prévue dans la cible, pour un GMF-U.</li><li>Elle vise généralement un médecin ayant le statut de <strong>nouveau facturant (NF)</strong>.</li><li>Un médecin ayant le statut de <strong>mobilité interrégionale (MIR)</strong> peut aussi être recruté.</li><li>Les <strong>600 jours de facturation ne sont pas exigés</strong>.</li><li>Le <strong>directeur du département de médecine de famille</strong> sélectionne la candidature.</li></ul></div>
<div><h3>Recrutement en surplus de la cible</h3><ul class="check-list caution"><li>Le recrutement s’ajoute <strong>au-delà</strong> de la cible régionale.</li><li>L’approbation du <strong>COGEM</strong> (comité de gestion des effectifs médicaux) est requise.</li><li>Le médecin doit avoir <strong>trois années de pratique active</strong> et <strong>600 jours de facturation</strong>.</li><li>La candidature doit recevoir l’accord du <strong>directeur universitaire</strong>.</li><li>La <strong>totalité des inscriptions de patients</strong> doit se faire dans le GMF-U concerné.</li></ul></div>
</div>
<p class="source-row"><a class="source-chip" href="https://publications.msss.gouv.qc.ca/msss/fichiers/sante-quebec/25-Guide_gestion_PTEM.pdf" rel="noopener">Santé Québec · besoins universitaires</a><a class="source-chip" href="https://fmrq.qc.ca/postes-pem-ptem/medecine-familiale/ptem-en-gmf-u/" rel="noopener">FMRQ · conditions</a></p>
</section>
<section class="content-section" id="resident">
<p class="section-number">03</p><h2>Un résident finissant peut-il obtenir une place en GMF-U?</h2>
<p><strong>Oui.</strong><br>Un médecin qui commence à facturer détient normalement le statut de <strong>nouveau facturant (NF)</strong>.<br>Les places réservées aux besoins universitaires sont généralement destinées aux médecins ayant ce statut.</p>
<p>L’exigence de <strong>600 jours de facturation</strong> s’applique au <strong>recrutement en surplus de la cible</strong>, et non aux places réservées.</p>
<p class="source-row"><a class="source-chip" href="https://publications.msss.gouv.qc.ca/msss/fichiers/sante-quebec/25-Guide_gestion_PTEM.pdf" rel="noopener">Santé Québec · guide de gestion</a></p>
</section>
<section class="content-section" id="statuts">
<p class="section-number">04</p><h2>Quelle est la différence entre nouveau facturant et mobilité interrégionale?</h2>
<div class="card-grid two">
<article class="card accent-blue"><h3>Nouveau facturant (NF)</h3><p>Médecin ayant facturé <strong>moins de 200 jours</strong> d’au moins <strong>500 $ par jour</strong>.</p></article>
<article class="card accent-teal"><h3>Mobilité interrégionale (MIR)</h3><p>Médecin ayant cumulé <strong>200 jours ou plus</strong> de facturation d’au moins <strong>500 $</strong>.<br>La demande est alors déposée sous ce statut.</p></article>
</div>
<p>C’est le statut du médecin <strong>au moment du dépôt de la demande</strong> d’avis de conformité qui est pris en compte.</p>
<p class="source-row"><a class="source-chip" href="https://publications.msss.gouv.qc.ca/msss/fichiers/sante-quebec/25-Guide_gestion_PTEM.pdf" rel="noopener">Santé Québec · statuts NF et MIR</a><a class="source-chip" href="https://fmrq.qc.ca/postes-pem-ptem/medecine-familiale/lexique/" rel="noopener">FMRQ · lexique</a></p>
</section>
<section class="content-section" id="surplus">
<p class="section-number">05</p><h2>Quelles sont les conditions du recrutement en surplus?</h2>
<p>Un recrutement en GMF-U en surplus de la cible régionale exige :</p>
<div class="steps">
<div class="step"><span>1</span><div><strong>Trois années de pratique active</strong><p>Soit un minimum de 600 jours de facturation.</p></div></div>
<div class="step"><span>2</span><div><strong>L’accord du directeur du département universitaire de médecine familiale</strong><p>De la faculté de médecine concernée.</p></div></div>
<div class="step"><span>3</span><div><strong>Un profil correspondant aux fonctions universitaires attendues</strong><p>Selon les orientations du COGEM, en termes de tâches académiques et d’inscription de patients.</p></div></div>
<div class="step"><span>4</span><div><strong>L’inscription de tous les patients dans le GMF-U concerné</strong><p>La totalité des inscriptions du médecin.</p></div></div>
<div class="step"><span>5</span><div><strong>L’approbation du COGEM</strong><p>Le DTMF peut alors accorder un avis de conformité en surplus de sa cible régionale.</p></div></div>
</div>
<p class="source-row"><a class="source-chip" href="https://fmrq.qc.ca/postes-pem-ptem/medecine-familiale/ptem-en-gmf-u/" rel="noopener">FMRQ · recrutement en surplus</a><a class="source-chip" href="https://publications.msss.gouv.qc.ca/msss/fichiers/sante-quebec/25-Guide_gestion_PTEM.pdf" rel="noopener">Santé Québec · guide de gestion</a></p>
</section>
<section class="content-section" id="candidature">
<p class="section-number">06</p><h2>Comment déposer sa candidature?</h2>
<p>Le guide de gestion ne prévoit <strong>ni formulaire ni procédure de candidature distincts</strong> pour les places universitaires.<br>Le médecin dépose la <strong>demande d’avis de conformité habituelle</strong>; la particularité du volet universitaire est la confirmation du choix par la faculté.</p>
<div class="steps">
<div class="step"><span>1</span><div><strong>Remplir le formulaire de demande d’avis de conformité</strong><p>Le formulaire en ligne du cycle en cours est publié sur Québec.ca.<br>C’est le même que pour toute candidature PTEM.</p></div></div>
<div class="step"><span>2</span><div><strong>Indiquer les territoires visés</strong><p>Durant la période initiale, le candidat peut sélectionner <strong>deux régions</strong> et <strong>deux sous-territoires par région</strong>.</p></div></div>
<div class="step"><span>3</span><div><strong>Déposer la demande pendant la période initiale</strong><p>Du 1<sup>er</sup> au 15 décembre.<br>Toutes les demandes de cette période sont réputées reçues le 15 décembre et ont priorité sur les demandes ultérieures.</p></div></div>
<div class="step"><span>4</span><div><strong>Transmission au DTMF</strong><p>La demande est acheminée au département territorial de médecine familiale de la région visée, qui informe de sa décision tous les candidats ayant postulé dans sa région.</p></div></div>
<div class="step"><span>5</span><div><strong>Entrevue s’il y a lieu</strong><p>Le DTMF convoque en entrevue lorsque le nombre de candidatures dépasse le nombre de places.</p></div></div>
</div>
<div class="callout official"><strong>Pour une place en GMF-U :</strong> la candidature est <strong>sélectionnée par le directeur du département de médecine de famille</strong> de la faculté.<br>Aussitôt qu’un candidat est pressenti, et au plus tard le <strong>15 décembre</strong>, le directeur confirme son choix à Santé Québec et au DTMF responsable de la délivrance de l’avis de conformité.<br>La démarche du candidat passe donc <strong>d’abord par le GMF-U et la direction du département</strong>, en parallèle du dépôt de sa demande.</div>
<p class="source-row"><a class="source-chip" href="https://www.quebec.ca/gouvernement/travailler-gouvernement/sante-services-sociaux/travailler-comme-medecin-de-famille-au-quebec/deposer-candidature-prem-medecine-famille" rel="noopener">Québec.ca · déposer sa candidature</a><a class="source-chip" href="https://fmrq.qc.ca/postes-pem-ptem/medecine-familiale/processus-ptem/etapes-cles/" rel="noopener">FMRQ · étapes clés</a></p>
</section>
<section class="content-section" id="dates">
<p class="section-number">07</p><h2>Quelles dates s’appliquent à une candidature en GMF-U?</h2>
<p>Une seule date est <strong>propre au volet universitaire</strong> : le <strong>15 décembre</strong>, échéance de confirmation du choix par le directeur du département.<br>Le guide de gestion ne fixe <strong>aucune autre date propre aux places universitaires</strong>, et ne précise ni le nombre de places réservées ni leur répartition.</p>
<p>Les dates ci-dessous sont celles de la <strong>période initiale PTEM 2027</strong>, publiées par le DTMF de la Montérégie.<br>Elles s’appliquent à une candidature en GMF-U parce que la demande d’avis de conformité suit le processus habituel.<br>Ce calendrier est sous réserve de la signature finale de l’accord par le ministre.</p>
<div class="steps">
<div class="step"><span>1</span><div><strong>1<sup>er</sup> au 15 décembre</strong><p>Période initiale de dépôt des candidatures.<br>Toutes les demandes reçues durant cette période sont considérées comme reçues le 15 décembre.</p></div></div>
<div class="step"><span>2</span><div><strong>15 décembre : date propre au volet universitaire</strong><p>Date limite de confirmation du choix par le directeur du département de médecine de famille, auprès de Santé Québec et du DTMF.</p></div></div>
<div class="step"><span>3</span><div><strong>Entre le 16 et le 26 décembre</strong><p>Santé Québec transmet aux DTMF les candidatures reçues.</p></div></div>
<div class="step"><span>4</span><div><strong>5 au 30 janvier</strong><p>Période d’entrevues des candidats.</p></div></div>
<div class="step"><span>5</span><div><strong>30 janvier</strong><p>Réponse à tous les candidats à la suite des entrevues.</p></div></div>
<div class="step"><span>6</span><div><strong>27 février</strong><p>Fin de la période initiale de candidature.<br>Les demandes reçues après le 15 décembre sont traitées à compter du 28 février, selon le principe du premier arrivé, premier servi.</p></div></div>
</div>
<div class="callout official"><strong>Place réservée non pourvue :</strong> une place réservée aux besoins universitaires pour laquelle aucune candidature n’est confirmée à la date limite est <strong>retournée à la marge régionale</strong> et sert au recrutement général.</div>
<p class="source-row"><a class="source-chip" href="https://www.santemonteregie.qc.ca/plans-territoriaux-deffectifs-medicaux-ptem" rel="noopener">DTMF Montérégie · calendrier PTEM 2027</a><a class="source-chip" href="https://www.ramq.gouv.qc.ca/fr/professionnels/actualites/2026-07-24/modifications-temporaires-a-ep-prem" rel="noopener">RAMQ · Accord no 820</a><a class="source-chip" href="https://publications.msss.gouv.qc.ca/msss/fichiers/sante-quebec/25-Guide_gestion_PTEM.pdf" rel="noopener">Santé Québec · besoins universitaires</a></p>
<p><a class="text-cta" href="/monteregie-est/ptem/">Voir le calendrier PTEM complet →</a></p>
</section>
<section class="content-section" id="traitement">
<p class="section-number">08</p><h2>Comment une candidature en GMF-U est-elle traitée?</h2>
<div class="steps">
<div class="step"><span>1</span><div><strong>Évaluation par le milieu et la faculté</strong><p>Le GMF-U et la direction du département de médecine de famille évaluent la candidature.</p></div></div>
<div class="step"><span>2</span><div><strong>Confirmation du choix</strong><p>Le directeur transmet son choix à Santé Québec et au DTMF concerné, au plus tard le 15 décembre.</p></div></div>
<div class="step"><span>3</span><div><strong>Traitement par le DTMF</strong><p>Le DTMF traite la demande selon les règles du cycle PTEM en cours et, pour un recrutement en surplus, après approbation du COGEM.</p></div></div>
<div class="step"><span>4</span><div><strong>Délivrance de l’avis de conformité</strong><p>L’avis est délivré lorsque les conditions applicables sont remplies.</p></div></div>
</div>
<p class="source-row"><a class="source-chip" href="https://publications.msss.gouv.qc.ca/msss/fichiers/sante-quebec/25-Guide_gestion_PTEM.pdf" rel="noopener">Santé Québec · processus</a></p>
</section>
<section class="content-section" id="delais">
<p class="section-number">09</p><h2>Quels délais s’appliquent après la réponse du DTMF?</h2>
<p>Ces délais sont ceux du cycle PTEM général.<br>Le guide de gestion n’en fixe <strong>aucun de propre au volet universitaire</strong>.</p>
<div class="card-grid two">
<article class="card accent-blue"><h3>Accepter l’avis</h3><p>Lorsqu’un avis de conformité vous est offert, vous disposez de <strong>5 jours</strong> pour répondre durant la période initiale.<br>À partir du 28 février et pour le reste de l’année, ce délai est de <strong>10 jours</strong>.</p><a class="source-chip" href="https://www.santemonteregie.qc.ca/plans-territoriaux-deffectifs-medicaux-ptem" rel="noopener">DTMF Montérégie</a></article>
<article class="card accent-teal"><h3>Commencer sa pratique</h3><p>Le médecin doit s’engager à commencer sa pratique dans un délai de <strong>12 mois</strong> suivant la date de réception de sa demande.<br>La FMRQ indique qu’un <strong>report additionnel maximal de 6 mois</strong> peut être demandé au DTMF.</p><a class="source-chip" href="https://fmrq.qc.ca/postes-pem-ptem/medecine-familiale/processus-ptem/vos-obligations/" rel="noopener">FMRQ · obligations</a></article>
</div>
<p class="note">L’absence de réponse dans le délai prescrit équivaut à un refus.</p>
</section>
<section class="content-section" id="apres">
<p class="section-number">10</p><h2>Quelles règles s’appliquent après le recrutement?</h2>
<p>Ces obligations sont celles de tout médecin de famille détenteur d’un avis de conformité; elles ne sont pas propres aux GMF-U.<br>S’y ajoute, pour un recrutement en surplus, l’inscription de la totalité des patients dans le GMF-U concerné.</p>
<div class="card-grid two">
<article class="card accent-blue"><h3>Règle du 55 %</h3><p>Le médecin doit effectuer <strong>au moins 55 % de ses jours de facturation</strong> dans la région ou le sous-territoire visé par son avis de conformité.</p><a class="source-chip" href="https://www.quebec.ca/gouvernement/travailler-gouvernement/sante-services-sociaux/travailler-comme-medecin-famille-quebec/plans-regionaux-effectifs-medicaux-medecine-famille" rel="noopener">Québec.ca</a></article>
<article class="card accent-teal"><h3>Activités médicales particulières</h3><p>Les AMP demeurent une <strong>obligation distincte</strong> du PTEM.<br>Le DTMF de la région où le médecin détient son avis est responsable de son dossier d’AMP.</p><a class="source-chip" href="https://www.fmoq.org/guide-pratique-fmoq/installation/amp/" rel="noopener">FMOQ</a></article>
</div>
<p><a class="text-cta" href="/monteregie-est/amp/">Lire le guide AMP vérifié →</a></p>
</section>
<section class="content-section" id="milieux">
<p class="section-number">11</p><h2>Où trouver les GMF-U de la Montérégie?</h2>
<p>Les GMF-U de la Montérégie figurent dans le répertoire et sur la carte interactive.<br>Les fiches affichent les renseignements disponibles sur le milieu, son équipe, ses horaires et son recrutement.</p>
<div class="cta-row"><a class="button primary" href="/monteregie-est/cliniques/">Comparer les milieux</a><a class="button secondary" href="/monteregie-est/">Ouvrir la carte</a></div>
</section>
<section class="content-section sources-panel" id="sources">
<p class="section-number">12</p><h2>Sources vérifiées</h2>
<p>Chaque donnée de cette page provient d’une source gouvernementale ou d’une source professionnelle de référence.<br>En cas de divergence, la source officielle la plus récente fait foi.</p>
<ul class="source-list rich"><li><a href="https://publications.msss.gouv.qc.ca/msss/fichiers/sante-quebec/25-Guide_gestion_PTEM.pdf" rel="noopener"><strong>Santé Québec : Guide de gestion des PTEM en médecine de famille</strong></a><span>Places réservées aux besoins universitaires, recrutement en surplus des cibles, statuts NF et MIR, confirmation du directeur, délai de 12 mois.</span></li>
<li><a href="https://www.ramq.gouv.qc.ca/fr/professionnels/actualites/2026-07-24/modifications-temporaires-a-ep-prem" rel="noopener"><strong>RAMQ : Accord no 820 / modifications temporaires à l’EP-PREM</strong></a><span>Dates du cycle PTEM 2027 : période d’application, dépôt, réponse des DTMF, délais d’acceptation.</span></li>
<li><a href="https://www.quebec.ca/gouvernement/travailler-gouvernement/sante-services-sociaux/travailler-comme-medecin-de-famille-au-quebec/deposer-candidature-prem-medecine-famille" rel="noopener"><strong>Québec.ca : Déposer sa candidature aux PTEM</strong></a><span>Formulaire de demande, choix de deux régions et de deux sous-territoires par région, transmission au DTMF.</span></li>
<li><a href="https://fmrq.qc.ca/postes-pem-ptem/medecine-familiale/ptem-en-gmf-u/" rel="noopener"><strong>FMRQ : PTEM en GMF-U</strong></a><span>Conditions du recrutement en surplus, rôle du directeur de département, places non confirmées.</span></li>
<li><a href="https://fmrq.qc.ca/postes-pem-ptem/medecine-familiale/processus-ptem/etapes-cles/" rel="noopener"><strong>FMRQ : Étapes clés du processus PTEM</strong></a><span>Entrevues, délais de réponse, traitement des candidatures tardives.</span></li>
<li><a href="https://fmrq.qc.ca/postes-pem-ptem/medecine-familiale/processus-ptem/vos-obligations/" rel="noopener"><strong>FMRQ : Vos obligations</strong></a><span>Délai d’installation et report additionnel.</span></li>
<li><a href="https://www.quebec.ca/gouvernement/travailler-gouvernement/sante-services-sociaux/travailler-comme-medecin-famille-quebec/plans-regionaux-effectifs-medicaux-medecine-famille" rel="noopener"><strong>Québec.ca : Plans territoriaux des effectifs médicaux</strong></a><span>Principes, portée des avis de conformité, règle du 55 %.</span></li>
</ul>
</section>
</main>
<footer class="site-footer"><div class="site-footer__inner">Trouve ta clinique est un outil d’information et de comparaison, indépendant du gouvernement du Québec et des DTMF. Pour toute décision officielle liée au PTEM ou aux AMP, validez l’information auprès du DTMF ou des sources gouvernementales compétentes.<div class="site-footer__copyright">© 2026 Olivier Laplante · Trouve ta clinique</div></div></footer>
<script>
document.querySelectorAll('.brand').forEach(function (b) {
  b.addEventListener('click', function () {
    b.classList.remove('tapped');
    void b.offsetWidth;
    b.classList.add('tapped');
  });
});
</script>
<script>
if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
  navigator.serviceWorker.getRegistrations().then(function (registrations) {
    registrations.forEach(function (registration) {
      try {
        if (new URL(registration.scope).pathname === '/') registration.unregister();
      } catch (e) {}
    });
  }).catch(function () {});
}
</script>
<!-- Cloudflare Web Analytics -->
<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"ceb6d077f71c46ffa566fe67de3eb336"}'></script>
<!-- End Cloudflare Web Analytics -->
</body>
</html>
`;

/* Bloc ajouté dans scripts/sources/ptem.html, juste après le paragraphe sur le résident
   finissant, pour que les deux pages se pointent l'une l'autre. */
const PTEM_ANCRE = `<p>Pour un résident qui termine sa formation et commence sa pratique, la démarche PTEM doit donc être planifiée avec la recherche de milieu, mais les deux démarches restent distinctes.</p>`;
const PTEM_AJOUT = `<p>Le recrutement dans un <strong>groupe de médecine de famille universitaire (GMF-U)</strong> suit des règles particulières : la candidature est sélectionnée par le directeur du département de médecine de famille, qui confirme son choix au plus tard le 15 décembre.</p>
<p><a class="text-cta" href="/monteregie-est/ptem-u/">Voir le PTEM en GMF-U (PTEM-U / PREM-U) →</a></p>`;

titre('1. scripts/sources/ptem-u.html');
fs.mkdirSync(path.dirname(CHEMIN_SOURCE), { recursive: true });
const dejaLa = fs.existsSync(CHEMIN_SOURCE) ? fs.readFileSync(CHEMIN_SOURCE, 'utf8') : null;
if (dejaLa === PAGE_SOURCE) {
  console.log('  identique, rien à écrire');
} else {
  fs.writeFileSync(CHEMIN_SOURCE, PAGE_SOURCE, 'utf8');
  console.log('  ' + (dejaLa === null ? 'créée' : 'mise à jour') + ' (' + PAGE_SOURCE.length + ' caractères)');
}

/* ---------- 1b. Lien réciproque depuis la page PTEM ---------- */
titre('1b. scripts/sources/ptem.html (lien vers la page PTEM-U)');
const CHEMIN_PTEM = path.join(RACINE, 'scripts', 'sources', 'ptem.html');
if (!fs.existsSync(CHEMIN_PTEM)) {
  stop('scripts/sources/ptem.html introuvable.');
}
let ptem = fs.readFileSync(CHEMIN_PTEM, 'utf8');
if (ptem.indexOf('/monteregie-est/ptem-u/') !== -1) {
  /* Un lien existe deja (pose a la main ou par une version anterieure) : on le garde, mais on
     applique la regle de denomination « PTEM-U (PREM-U) » a son libelle s'il ne l'a pas. */
  const avantLibelle = ptem;
  ptem = ptem.replace(/(<a[^>]*href="\/monteregie-est\/ptem-u\/"[^>]*>)([^<]*)(<\/a>)/g, function (tout, ouvre, texte, ferme) {
    if (texte.indexOf('PREM-U') !== -1 || texte.indexOf('PTEM-U') === -1) return tout;
    return ouvre + texte.replace('PTEM-U', 'PTEM-U (PREM-U)') + ferme;
  });
  if (ptem !== avantLibelle) {
    fs.writeFileSync(CHEMIN_PTEM, ptem, 'utf8');
    console.log('  lien déjà présent, libellé complété en « PTEM-U (PREM-U) »');
  } else {
    console.log('  lien déjà présent');
  }
} else {
  const ancre = PTEM_ANCRE;
  if (ptem.split(ancre).length - 1 !== 1) {
    stop('ancre introuvable ou multiple dans scripts/sources/ptem.html : la page a changé, ne rien écrire.');
  }
  ptem = ptem.replace(ancre, ancre + '\n' + PTEM_AJOUT);
  fs.writeFileSync(CHEMIN_PTEM, ptem, 'utf8');
  console.log('  lien ajouté après le paragraphe sur le résident finissant');
}

/* ---------- 2. Générateur ---------- */
const EDITS = [
  { nom: "Constantes de lien vers la page", avant: "const GMFU_CONDITION_SEO =", apres: "/* Portes d'entrée vers /monteregie-est/ptem-u/ : la page n'est volontairement PAS dans la\n   navigation principale (décision d'Olivier, 12 sept. 2026). On y arrive par la recherche du\n   bandeau et par les milieux GMF-U. Ne retirer aucune de ces deux portes sans en ouvrir une autre. */\nconst LIEN_PTEM_U = '<a class=\"text-cta\" href=\"/monteregie-est/ptem-u/\">Comprendre le PTEM en GMF-U \\u2192</a>';\n/* Entrée de liste « Pour aller plus loin ». Le saut de ligne est porté par la constante, pour\n   qu'une fiche non GMF-U ne récolte pas une ligne vide. */\nconst LI_PTEM_U = '\\n      <li><a href=\"/monteregie-est/ptem-u/\">PTEM en GMF-U : place réservée et recrutement universitaire</a></li>';\nconst GMFU_CONDITION_SEO =" },
  { nom: "Description de la page-guide", avant: "const DESC_CLINIQUES_EST = ", apres: "const DESC_PTEM_U = 'PTEM-U (PREM-U), le PTEM en GMF-U : place réservée aux besoins universitaires, recrutement en surplus, statut de nouveau facturant (NF), confirmation du 15 décembre et dépôt de la candidature.';\nconst DESC_CLINIQUES_EST = " },
  { nom: "Description choisie par nom de page", avant: "  const descGuide = nom === 'amp' ? DESC_AMP : DESC_PTEM;", apres: "  const descGuide = DESC_GUIDE_PAR_NOM[nom] || DESC_PTEM;" },
  { nom: "FAQ choisie par nom de page", avant: "    const faq = nom === 'amp' ? FAQ_AMP : FAQ_PTEM;", apres: "    const faq = FAQ_GUIDE_PAR_NOM[nom] || FAQ_PTEM;" },
  { nom: "FAQPage de la page PTEM-U + tables par nom", avant: "      name: 'Qui doit adhérer aux AMP?',\n      acceptedAnswer: { '@type': 'Answer', text: 'Tous les médecins de famille qui exercent dans le régime public sont visés par l’engagement AMP.' }\n    }\n  ]\n};\n", apres: "      name: 'Qui doit adhérer aux AMP?',\n      acceptedAnswer: { '@type': 'Answer', text: 'Tous les médecins de famille qui exercent dans le régime public sont visés par l’engagement AMP.' }\n    }\n  ]\n};\n\nconst FAQ_PTEM_U = {\n  '@type': 'FAQPage',\n  mainEntity: [\n    {\n      '@type': 'Question',\n      name: 'Qu’est-ce que le PTEM-U (PREM-U)?',\n      acceptedAnswer: { '@type': 'Answer', text: 'Le PTEM-U (PREM-U) est le volet universitaire du plan territorial des effectifs médicaux. Les documents officiels parlent de PTEM en GMF-U et de besoins universitaires. Deux modes de recrutement sont prévus : une place réservée aux besoins universitaires et un recrutement en surplus de la cible régionale.' }\n    },\n    {\n      '@type': 'Question',\n      name: 'Un résident finissant peut-il obtenir une place en GMF-U?',\n      acceptedAnswer: { '@type': 'Answer', text: 'Oui. Un médecin qui commence à facturer détient normalement le statut de nouveau facturant (NF), soit moins de 200 jours facturés d’au moins 500 $ par jour. Les places réservées aux besoins universitaires sont généralement destinées aux médecins ayant ce statut. L’exigence de 600 jours de facturation s’applique au recrutement en surplus de la cible.' }\n    },\n    {\n      '@type': 'Question',\n      name: 'Comment postuler à une place en GMF-U?',\n      acceptedAnswer: { '@type': 'Answer', text: 'Le guide de gestion ne prévoit ni formulaire ni procédure distincts pour les places universitaires : le médecin dépose la demande d’avis de conformité habituelle durant la période initiale du 1er au 15 décembre. La particularité du volet universitaire est la sélection de la candidature par le directeur du département de médecine de famille de la faculté.' }\n    },\n    {\n      '@type': 'Question',\n      name: 'Quelle date est propre au volet universitaire?',\n      acceptedAnswer: { '@type': 'Answer', text: 'Le 15 décembre : le directeur du département de médecine de famille confirme son choix à Santé Québec et au DTMF au plus tard à cette date. Une place réservée sans candidature confirmée est retournée à la marge régionale. Le guide ne fixe aucune autre date propre aux places universitaires.' }\n    }\n  ]\n};\n\n/* Métadonnées par page-guide : ajouter une entrée ici en même temps que scripts/sources/<nom>.html. */\nconst DESC_GUIDE_PAR_NOM = { ptem: DESC_PTEM, amp: DESC_AMP, 'ptem-u': DESC_PTEM_U };\nconst FAQ_GUIDE_PAR_NOM = { ptem: FAQ_PTEM, amp: FAQ_AMP, 'ptem-u': FAQ_PTEM_U };\nconst LIBELLE_GUIDE_PAR_NOM = { ptem: 'La page PTEM', amp: 'La page AMP', 'ptem-u': 'La page PTEM en GMF-U' };\n" },
  { nom: "Publication de la 3e page-guide", avant: "  for (const nom of ['ptem', 'amp']) {", apres: "  for (const nom of ['ptem', 'amp', 'ptem-u']) {" },
  { nom: "Libellé de la page de redirection", avant: "    const libelle = nom === 'ptem' ? 'La page PTEM' : 'La page AMP';", apres: "    const libelle = LIBELLE_GUIDE_PAR_NOM[nom] || 'La page';" },
  { nom: "Entrée sitemap|garde=loc: '/monteregie-est/ptem-u/'", avant: "  { loc: '/monteregie-est/amp/', lastmod: null, changefreq: 'monthly', priority: '0.9' },", apres: "  { loc: '/monteregie-est/amp/', lastmod: null, changefreq: 'monthly', priority: '0.9' },\n  /* PTEM en GMF-U : hors navigation principale, mais indexable et dans le sitemap — c'est par la\n     recherche et par les fiches GMF-U qu'on y arrive. Priorité plus basse que /ptem/ en conséquence. */\n  { loc: '/monteregie-est/ptem-u/', lastmod: null, changefreq: 'monthly', priority: '0.6' }," },
  { nom: "Entrée dans l'index de la recherche du bandeau|garde=url: '/monteregie-est/ptem-u/'", avant: "    { nom: 'AMP : activités médicales particulières', url: '/monteregie-est/amp/', extra: 'amp heures ramq' }\n  ];", apres: "    { nom: 'AMP : activités médicales particulières', url: '/monteregie-est/amp/', extra: 'amp heures ramq' },\n    { nom: 'PTEM en GMF-U (PTEM-U / PREM-U)', url: '/monteregie-est/ptem-u/', extra: 'ptem-u ptemu prem-u premu prem en gmf-u gmf-u gmfu universitaire umf place reservee besoins universitaires enseignement resident finissant nouveau facturant mir' }\n  ];" },
  { nom: "Lien dans le texte des secteurs GMF-U (Est)", avant: "    extra.push(`<p>Le secteur GMF-U est en recrutement.</p><p>${htmlGmfuConditionSeo()}</p>`);", apres: "    extra.push(`<p>Le secteur GMF-U est en recrutement.</p><p>${htmlGmfuConditionSeo()}</p><p>${LIEN_PTEM_U}</p>`);" },
  { nom: "Lien dans le texte des secteurs GMF-U (Centre)", avant: "  if (s.categorieActivite === 'gmf-u') blocs.push(`<p>${htmlGmfuConditionSeo()}</p>`);", apres: "  if (s.categorieActivite === 'gmf-u') blocs.push(`<p>${htmlGmfuConditionSeo()}</p><p>${LIEN_PTEM_U}</p>`);" },
  { nom: "« Pour aller plus loin » — fiches cliniques GMF-U", avant: "      ${String(c.id) === '45' ? `<li><a href=\"${CENTRE_PREFIXE}/etablissements/gmf-u-de-saint-jean-sur-richelieu/\">Secteurs en établissement du GMF-U</a></li>` : ''}\n      <li><a href=\"${EST_PREFIXE}/ptem/\">Comprendre le PTEM et l’avis de conformité</a></li>", apres: "      ${String(c.id) === '45' ? `<li><a href=\"${CENTRE_PREFIXE}/etablissements/gmf-u-de-saint-jean-sur-richelieu/\">Secteurs en établissement du GMF-U</a></li>` : ''}\n      <li><a href=\"${EST_PREFIXE}/ptem/\">Comprendre le PTEM et l’avis de conformité</a></li>${c.type === 'GMF-U' ? LI_PTEM_U : ''}" },
  { nom: "« Pour aller plus loin » — fiches établissement GMF-U (Est)", avant: "      <li><a href=\"${EST_PREFIXE}/ptem/\">Comprendre le PTEM et l’avis de conformité</a></li>\n      <li><a href=\"${EST_PREFIXE}/amp/\">Comprendre les activités médicales particulières (AMP)</a></li>\n      <li><a href=\"${esc(lienCarteInstallation(inst.id))}\">", apres: "      <li><a href=\"${EST_PREFIXE}/ptem/\">Comprendre le PTEM et l’avis de conformité</a></li>${inst.type === 'gmf-u' ? LI_PTEM_U : ''}\n      <li><a href=\"${EST_PREFIXE}/amp/\">Comprendre les activités médicales particulières (AMP)</a></li>\n      <li><a href=\"${esc(lienCarteInstallation(inst.id))}\">" },
  { nom: "« Pour aller plus loin » — fiches établissement GMF-U (Centre)", avant: "      <li><a href=\"${EST_PREFIXE}/ptem/\">Comprendre le PTEM et l’avis de conformité</a></li>\n      <li><a href=\"${esc(lienCarteInstallationCentre(inst.id))}\">", apres: "      <li><a href=\"${EST_PREFIXE}/ptem/\">Comprendre le PTEM et l’avis de conformité</a></li>${inst.type === 'gmf-u' ? LI_PTEM_U : ''}\n      <li><a href=\"${esc(lienCarteInstallationCentre(inst.id))}\">" }
];

titre('2. scripts/generer-pages-seo.js');
let gen = fs.readFileSync(CHEMIN_GEN, 'utf8');
const genAvant = gen;

/* Mise à jour d'une version antérieure de la description et de la FAQ, s'il y en a une. */
const DESC_LIGNE = EDITS.find(e => e.nom.indexOf('Description de la page-guide') === 0).apres.split('\n')[0];
if (/^const DESC_PTEM_U = .*$/m.test(gen)) {
  const actuelle = gen.match(/^const DESC_PTEM_U = .*$/m)[0];
  if (actuelle !== DESC_LIGNE) { gen = gen.replace(actuelle, DESC_LIGNE); console.log('  description : mise à jour'); }
}
const FAQ_NOUVELLE = EDITS.find(e => e.nom.indexOf('FAQPage') === 0).apres.match(/const FAQ_PTEM_U = \{[\s\S]*?\n\};/)[0];
const IDX_LIGNE = EDITS.find(e => e.nom.indexOf('Entrée dans l\'index') === 0).apres.split('\n')[1];
if (/^ *\{ nom: '[^']*', url: '\/monteregie-est\/ptem-u\/'.*$/m.test(gen)) {
  const actuelle = gen.match(/^ *\{ nom: '[^']*', url: '\/monteregie-est\/ptem-u\/'.*$/m)[0];
  let rempl = IDX_LIGNE;
  /* La ligne remplacee peut etre suivie d'autres entrees : conserver sa virgule finale, sinon
     le tableau devient invalide (deux objets colles sans separateur). */
  const virguleActuelle = actuelle.trimEnd().slice(-1) === ',';
  const virguleRempl = rempl.trimEnd().slice(-1) === ',';
  if (virguleActuelle && !virguleRempl) rempl = rempl.trimEnd() + ',';
  if (!virguleActuelle && virguleRempl) rempl = rempl.trimEnd().slice(0, -1);
  if (actuelle !== rempl) { gen = gen.replace(actuelle, rempl); console.log('  index de recherche : mis à jour'); }
}
if (/const FAQ_PTEM_U = \{[\s\S]*?\n\};/.test(gen)) {
  const actuelle = gen.match(/const FAQ_PTEM_U = \{[\s\S]*?\n\};/)[0];
  if (actuelle !== FAQ_NOUVELLE) { gen = gen.replace(actuelle, FAQ_NOUVELLE); console.log('  FAQPage : mis à jour'); }
}

let appliques = 0, sautes = 0, variantes = 0;
/* Une constante deja declaree (par Cursor ou par une version anterieure) ne doit jamais etre
   redeclaree : Node refuse le fichier avec « Identifier has already been declared ». */
function constantesDejaDeclarees(source, e) {
  const noms = [];
  const re = /const ([A-Z][A-Z0-9_]+) =/g;
  let m;
  while ((m = re.exec(e.apres)) !== null) {
    if (e.avant.indexOf('const ' + m[1] + ' =') === -1) noms.push(m[1]);
  }
  return noms.filter(function (nom) { return source.indexOf('const ' + nom + ' =') !== -1 || source.indexOf('const ' + nom + '=') !== -1; });
}

for (const e of EDITS) {
  /* Garde explicite : une entree equivalente existe deja sous une autre forme (autre lastmod,
     autres mots-cles). On ne la duplique pas; l'etape de mise a jour plus haut s'en est chargee. */
  const sep = e.nom.indexOf('|garde=');
  const garde = sep === -1 ? null : e.nom.slice(sep + 7);
  const nomAffiche = sep === -1 ? e.nom : e.nom.slice(0, sep);
  if (garde && gen.indexOf(garde) !== -1) {
    console.log('  ~ ' + nomAffiche + ' : entrée déjà présente, non dupliquée');
    variantes++;
    continue;
  }
  if (gen.indexOf(e.apres) !== -1) { sautes++; continue; }
  const dejaDeclarees = constantesDejaDeclarees(gen, e);
  if (dejaDeclarees.length) {
    console.log('  ~ ' + nomAffiche + ' : ' + dejaDeclarees.join(', ') + ' déjà déclarée(s), non modifiée(s)');
    variantes++;
    continue;
  }
  /* Le point d'insertion porte deja un lien PTEM-U sous une autre forme : ne pas en ajouter un 2e. */
  const pos = gen.indexOf(e.avant);
  if (pos !== -1 && gen.slice(pos + e.avant.length, pos + e.avant.length + 90).indexOf('PTEM_U') !== -1) {
    console.log('  ~ ' + nomAffiche + ' : lien déjà posé à cet endroit, non modifié');
    variantes++;
    continue;
  }
  const n = gen.split(e.avant).length - 1;
  if (n !== 1) {
    /* Le cablage a pu etre pose autrement (par Cursor, ou par une version anterieure du lot).
       Dans ce cas on ne force rien : on saute, et les controles de l'etape 4 verifient le
       resultat reel plutot que la forme du code. */
    if (gen.indexOf('/monteregie-est/ptem-u/') !== -1) {
      console.log('  ~ ' + nomAffiche + ' : variante déjà en place, non modifiée');
      variantes++;
      continue;
    }
    stop('« ' + nomAffiche + ' » : ' + n + ' occurrence(s) de l\'ancre au lieu d\'une seule, et aucun câblage PTEM-U existant. Le générateur a changé; ne rien écrire.');
  }
  gen = gen.replace(e.avant, e.apres);
  appliques++;
  console.log('  + ' + nomAffiche);
}
if (gen !== genAvant) {
  fs.writeFileSync(CHEMIN_GEN, gen, 'utf8');
  cp.execSync('node --check "' + CHEMIN_GEN + '"');
  console.log('  ' + appliques + ' appliquée(s), ' + sautes + ' déjà en place, ' + variantes + ' variante(s) respectée(s) · syntaxe vérifiée');
} else {
  console.log('  déjà à jour (' + sautes + ' en place, ' + variantes + ' variante(s) respectée(s))');
}

/* ---------- 3. Génération ---------- */
titre('3. Génération des pages');
const sortie = cp.execSync('node scripts/generer-pages-seo.js', { encoding: 'utf8', cwd: RACINE, maxBuffer: 32 * 1024 * 1024 });
for (const l of sortie.split('\n')) {
  if (/Pages de cliniques|Pages de RLS|Recherche |Sitemap |GMF-U canoniques/.test(l)) console.log('  ' + l.trim());
}

/* ---------- 4. Contrôles ---------- */
titre('4. Contrôles');
const pageGeneree = path.join(RACINE, 'monteregie-est', 'ptem-u', 'index.html');
if (!fs.existsSync(pageGeneree)) stop('monteregie-est/ptem-u/index.html n\'a pas été produit.');
const html = fs.readFileSync(pageGeneree, 'utf8');
const nav = (html.match(/<nav aria-label="Navigation principale"[\s\S]*?<\/nav>/) || [''])[0];
const controles = [
  ['page générée', true],
  ['pas de lien PTEM-U dans le menu', nav.indexOf('ptem-u') === -1],
  ['indexable (robots index,follow)', /content="index,follow/.test(html)],
  ['canonique présente', html.indexOf('rel="canonical"') !== -1],
  ['recherche du bandeau injectée', html.indexOf('/assets/recherche.js') !== -1],
  ['FAQPage présent', html.indexOf('"@type": "FAQPage"') !== -1],
  ['jeton {{ASSETS}} résolu', html.indexOf('{{ASSETS}}') === -1],
  ['présente dans le sitemap', fs.readFileSync(path.join(RACINE, 'sitemap.xml'), 'utf8').indexOf('/monteregie-est/ptem-u/') !== -1],
  ['présente dans l\'index de recherche', fs.readFileSync(path.join(RACINE, 'recherche', 'donnees.json'), 'utf8').indexOf('/monteregie-est/ptem-u/') !== -1],
  ['lien réciproque depuis la page PTEM', fs.readFileSync(path.join(RACINE, 'monteregie-est', 'ptem', 'index.html'), 'utf8').indexOf('/monteregie-est/ptem-u/') !== -1],
  ['aucun tiret cadratin dans la page', html.indexOf('\u2014') === -1],
  ['libellé PREM-U présent', html.indexOf('PREM-U') !== -1],
  ['lien depuis les fiches GMF-U', (function () {
    const cibles = ['monteregie-est/etablissements/gmf-u-des-monteregiennes/index.html',
                    'monteregie-est/etablissements/gmf-u-richelieu-yamaska/index.html'];
    return cibles.every(function (rel) {
      const f = path.join(RACINE, rel);
      return fs.existsSync(f) && fs.readFileSync(f, 'utf8').indexOf('/monteregie-est/ptem-u/') !== -1;
    });
  })()]
];
let echec = false;
for (const [nom, ok] of controles) { console.log('  ' + (ok ? 'OK  ' : 'NON ') + nom); if (!ok) echec = true; }
if (echec) stop('un contrôle a échoué — ne pas committer en l\'état.');

const modifies = cp.execSync('git status --short', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
titre('5. Fichiers touchés (' + modifies.length + ')');
modifies.forEach(l => console.log('  ' + l));
console.log('\n  Note : sitemap.xml porte aussi la mise à jour des dates `lastmod` que le générateur');
console.log('  applique de lui-même à chaque exécution — ce n\'est pas propre à ce lot.');

/* ---------- 6. Git ---------- */
const MESSAGE = 'Ajout de la page PTEM en GMF-U (/monteregie-est/ptem-u/)\n\n' +
  'Page-guide destinee aux residents en medecine familiale : deux modes de recrutement,\n' +
  'statuts NF et MIR, depot de candidature et dates du cycle PTEM 2027.\n' +
  'Hors navigation principale : accessible par la recherche du bandeau, par les fiches des\n' +
  'milieux GMF-U et par les moteurs de recherche (indexable, sitemap 0.6).';

if (COMMIT) {
  titre('6. Git');
  cp.execSync('git add -A', { stdio: 'inherit' });
  cp.execSync('git commit -F -', { input: MESSAGE, stdio: ['pipe', 'inherit', 'inherit'] });
  if (PUSH) {
    cp.execSync('git push', { stdio: 'inherit' });
    console.log('\n  Poussé. Le workflow apercu-brouillon.yml publie sur https://apercu.trouvetaclinique.ca/monteregie-est/ptem-u/');
  } else {
    console.log('\n  Commit fait. Pousser avec : git push');
  }
} else {
  titre('6. Pour publier sur l\'aperçu');
  console.log('  git checkout brouillon        # si ce n\'est pas déjà la branche courante');
  console.log('  git add -A');
  console.log('  git commit -m "Ajout de la page PTEM en GMF-U (/monteregie-est/ptem-u/)"');
  console.log('  git push                      # -> apercu.trouvetaclinique.ca via apercu-brouillon.yml');
  console.log('\n  ou relancer : node scripts/deposer-ptem-u.js --commit --push');
}
console.log('');
