'use strict';

// Le catalogue réutilise l'en-tête, le pied et les comportements de l'accueil.
// Appelé après sa génération, pour suivre automatiquement les composants communs.
const fs = require('node:fs');
const path = require('node:path');
/* Adresse du service d'aiguillage IA (Worker Cloudflare, dossier workers/aiguillage).
   Vide : la boîte « Demander à l'IA » n'est pas affichée et son script n'est pas chargé. */
const URL_AIGUILLAGE = 'https://trouvetaclinique-aiguillage.o-laplante27.workers.dev/';

/* Ordre d'affichage des sujets (le champ « cat » de guides/donnees.json). Un sujet absent
   de cette liste s'affiche à la fin : l'ajouter ici pour choisir sa place. */
const ORDRE_SUJETS = [
  'Infections et ITSS', 'Respiratoire', 'Cardiovasculaire et métabolique', 'Thrombose et anticoagulation',
  'Digestif et foie', 'Santé mentale, dépendances et sommeil', 'Santé des femmes et grossesse', 'Pédiatrie',
  'Gériatrie et troubles neurocognitifs', 'Os, articulations et douleur', 'Peau et yeux',
  'ORL (oreilles, nez, gorge)', 'Hématologie et oncologie',
  'Prévention et vaccination', 'Urgence et traumatologie', 'Soins palliatifs et niveaux de soins',
  'Imagerie médicale', 'Pratique professionnelle et protocoles', 'Documents pour les patients',
  'Ressources communautaires'
];
const SOURCE_COMMUNAUTAIRE = 'https://reseaudhabitationschezsoi.org/data/documents/Bottin-version-web_1.pdf';

/* Numéros de téléphone d'un texte libre changés en liens tel: (le reste du texte est échappé). */
function lierTelephones(texte) {
  const motif = /(?:1[\s-])?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}/g;
  let html = '', dernier = 0, m;
  while ((m = motif.exec(texte))) {
    const chiffres = m[0].replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    html += esc(texte.slice(dernier, m.index)) + `<a href="tel:+1${chiffres}">${esc(m[0].trim())}</a>`;
    dernier = m.index + m[0].length;
  }
  return html + esc(texte.slice(dernier));
}

/* Ville sans la mention « (hors territoire) », qui devient un attribut à part. */
const HORS_TERRITOIRE = / \(hors territoire\)$/;
const villeDe = r => (r.ville || '').replace(HORS_TERRITOIRE, '');
const estHors = r => HORS_TERRITOIRE.test(r.ville || '');
const rubriqueDe = r => r.rubrique.split(' · ')[0];

function carteCommunautaire(r) {
  /* Rubrique principale et ses sous-rubriques (ex. « Hébergement · Femmes, Hommes »). */
  const section = rubriqueDe(r);
  const sous = (r.rubriques || []).filter(x => x.startsWith(section + ' · ')).map(x => x.split(' · ')[1]);
  const lieu = [section + (sous.length ? ' · ' + sous.join(', ') : ''), r.ville].filter(Boolean).join(' · ');
  const details = [['Pour qui', r.pourQui], ['Heures', r.heures], ['Accès', r.acces]].filter(([, v]) => v);
  const principales = [...new Set((r.rubriques || [r.rubrique]).map(x => x.split(' · ')[0]))];
  return `<li class="guides-resource guides-resource--comm" data-id="${esc(r.url)}" data-type="communautaire" data-title="${esc(r.title)}" data-org="${esc(r.org)}" data-desc="${esc(r.desc || '')}" data-category="${esc(section)}" data-rubriques="${esc(principales.join('|'))}" data-rubriques-detail="${esc((r.rubriques || []).join(' '))}" data-ville="${esc(villeDe(r))}"${estHors(r) ? ' data-hors="1"' : ''} data-tags="${esc(r.tags)}">
        <a class="guides-resource-link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">
          <span class="guides-resource-source">${esc(lieu)}</span>
          <h3>${esc(r.title)}</h3>
          ${r.services ? `<span class="guides-comm-services">${esc(r.services)}</span>` : ''}
          <span class="guides-resource-arrow" aria-hidden="true">↗</span>
          <span class="visually-hidden"> (nouvel onglet)</span>
        </a>
        <div class="guides-comm-infos">
          ${r.telephone ? `<p class="guides-comm-tel"><span class="visually-hidden">Téléphone : </span>${lierTelephones(r.telephone)}</p>` : ''}
          ${r.adresse ? `<p class="guides-comm-adresse">${esc(r.adresse)}</p>` : ''}
          ${details.length ? `<details><summary>Détails : ${esc(details.map(([k]) => k.toLowerCase()).join(', '))}</summary><dl>${details.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${lierTelephones(v)}</dd>`).join('')}</dl></details>` : ''}
        </div>
      </li>`;
}
const ancre = texte => 'sujet-' + texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* Bouton « Proposer un guide ou une ressource » : courriel prérempli, même adresse que
   « Signaler une clinique » (scripts/generer-pages-seo.js). */
const COURRIEL_PROPOSITION = 'olivier.laplante.med@ssss.gouv.qc.ca';
const PROPOSITION_HREF = 'mailto:' + COURRIEL_PROPOSITION + '?subject=' + encodeURIComponent('Proposition pour le catalogue de guides')
  + '&body=' + encodeURIComponent('Bonjour,\n\nJe propose d’ajouter au catalogue /guides/ :\n\nTitre : \nOrganisme : \nLien : \nPourquoi c’est utile en première ligne : \n\nMerci !');

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));


/* Deux pages tirées du même catalogue (guides/donnees.json) : les guides cliniques à /guides/ et
   les organismes communautaires à /guides/ressources-communautaires/, dans la portée de l'app
   « Guides ». Les deux partagent l'en-tête, les onglets, la recherche, l'IA et les favoris. */
const PAGES = {
  guides: {
    chemin: '/guides/',
    onglet: 'Guides cliniques',
    mot: 'ressource',
    titre: 'Guides de pratique pour la première ligne | Trouve ta clinique',
    description: 'Guides de pratique, algorithmes et documents pour les patients en médecine familiale en Montérégie. Recherchez par sujet ou organisme et consultez les sources originales.',
    ogTitre: 'Guides pratiques et ressources cliniques',
    ogDescription: 'Guides de pratique, algorithmes et ressources pour la médecine familiale, classés par sujet et par organisme, avec un lien direct vers la source originale.',
    ogAlt: 'Guides pratiques, algorithmes et ressources communautaires · Trouve ta clinique',
    ldDescription: 'Catalogue de guides de pratique, algorithmes et ressources pour la médecine familiale en première ligne.',
    eyebrow: 'Médecine familiale · Première ligne',
    h1: 'Guides pratiques et ressources cliniques',
    lead: 'Retrouvez les guides de pratique, algorithmes et documents pour les patients utiles à la médecine familiale.',
    rechercheTitre: 'Quelle ressource cherchez-vous&nbsp;?',
    rechercheEtiquette: 'Rechercher une ressource clinique',
    placeholder: 'Sujet, organisme ou mot-clé…',
    aide: 'Mots-clés ou phrase complète, par exemple : MPOC, otite chez un enfant allergique, patient sous apixaban. Les abréviations, synonymes et fautes de frappe courantes sont reconnus.',
    catalogueTitre: 'Parcourir par sujet',
    iaTitre: 'Demandez à l’IA quel guide consulter',
    iaIntro: 'Décrivez la situation en quelques mots : l’IA suggère jusqu’à 5 guides du catalogue et explique chaque choix. Elle ne donne pas d’avis clinique.',
    iaExemple: 'Ex. : toux depuis 4 semaines chez un fumeur de 60 ans',
    proposerTexte: 'Proposez un guide de pratique, un outil clinique ou un document pour les patients utile en première ligne : il sera vérifié avant d’être ajouté au catalogue.'
  },
  communautaire: {
    chemin: '/guides/ressources-communautaires/',
    onglet: 'Ressources communautaires',
    mot: 'organisme',
    titre: 'Ressources communautaires pour vos patients | Trouve ta clinique',
    description: 'Organismes communautaires et lignes d’aide vers qui diriger vos patients en Montérégie-Est : aide alimentaire, hébergement, santé mentale, dépendances, proches aidants. Recherche par ville et par type d’aide.',
    ogTitre: 'Ressources communautaires pour vos patients',
    ogDescription: 'Organismes communautaires et lignes d’aide de la Montérégie-Est, classés par type d’aide et par ville, avec téléphone et adresse.',
    ogAlt: 'Ressources communautaires · Trouve ta clinique',
    ldDescription: 'Répertoire d’organismes communautaires et de lignes d’aide vers qui diriger les patients en Montérégie-Est.',
    eyebrow: 'Médecine familiale · Soutien aux patients',
    h1: 'Ressources communautaires pour vos patients',
    lead: 'Trouvez un organisme communautaire ou une ligne d’aide vers qui diriger un patient : aide alimentaire, hébergement, santé mentale, dépendances, proches aidants, droits et plus encore.',
    rechercheTitre: 'De quel soutien votre patient a-t-il besoin&nbsp;?',
    rechercheEtiquette: 'Rechercher un organisme communautaire',
    placeholder: 'Besoin, organisme ou ville…',
    aide: 'Mots-clés ou phrase complète, par exemple : banque alimentaire à Longueuil, hébergement pour femme victime de violence, répit pour proche aidant.',
    catalogueTitre: 'Parcourir par type d’aide',
    iaTitre: 'Demandez à l’IA vers quel organisme diriger votre patient',
    iaIntro: 'Décrivez le besoin en quelques mots : l’IA suggère jusqu’à 5 organismes ou lignes d’aide du catalogue et explique chaque choix.',
    iaExemple: 'Ex. : aîné isolé à Boucherville qui a besoin de repas',
    proposerTexte: 'Proposez un organisme communautaire ou une ligne d’aide utile à vos patients : il sera vérifié avant d’être ajouté au catalogue.'
  }
};

/* Note sur la provenance des organismes, en tête de la page communautaire. */
const NOTE_COMMUNAUTAIRE = `Organismes de l’agglomération de Longueuil, de la région de Saint-Hyacinthe et de la Vallée-du-Richelieu, tirés du <a href="${SOURCE_COMMUNAUTAIRE}" target="_blank" rel="noopener noreferrer">bottin de ressources 2023 du Réseau d’habitations chez soi<span class="visually-hidden"> (nouvel onglet)</span></a> et des répertoires des corporations de développement communautaire (CDC). Les heures et les conditions peuvent avoir changé : téléphonez avant de diriger quelqu’un.<br>Ailleurs en Montérégie : <a href="https://www.211qc.ca/" target="_blank" rel="noopener noreferrer">211<span class="visually-hidden"> (nouvel onglet)</span></a> (composez le <a href="tel:211">2-1-1</a>). En cas de détresse psychosociale : Info-Social <a href="tel:811">811</a>, option 2.`;

const SANS_ADRESSE = '(sans adresse)';

function carteGuide(r) {
  return `<li class="guides-resource" data-tags="${esc(r.tags)}" data-id="${esc(r.url)}" data-title="${esc(r.title)}" data-org="${esc(r.org)}" data-desc="${esc(r.desc || '')}" data-category="${esc(r.cat)}" data-search="${esc([r.title,r.org,r.cat,r.tags,r.desc].join(' '))}">
        <a class="guides-resource-link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">
          <span class="guides-resource-source">${esc(r.org)}</span>
          <h3>${esc(r.title)}</h3>
          <span class="guides-keywords">${esc(r.tags)}</span>
          <span class="guides-resource-arrow" aria-hidden="true">↗</span>
          <span class="visually-hidden"> (nouvel onglet)</span>
        </a>
      </li>`;
}

const compter = (liste, cle) => liste.reduce((m, x) => { const k = cle(x); return m.set(k, (m.get(k) || 0) + 1); }, new Map());
const option = (valeur, texte, n) => `<option value="${esc(valeur)}">${esc(texte)} (${n})</option>`;
const trierFr = liste => liste.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

function genererGuidesCliniques(racine = path.resolve(__dirname, '..')) {
  const accueil = fs.readFileSync(path.join(racine, 'index.html'), 'utf8');
  const ressources = JSON.parse(fs.readFileSync(path.join(racine, 'guides/donnees.json'), 'utf8'));
  const header = accueil.match(/<header class="site">[\s\S]*?<\/header>/)?.[0];
  const footer = accueil.match(/<footer class="pied-site">[\s\S]*?<\/footer>/)?.[0];
  if (!header || !footer) throw new Error('Composants communs de l’accueil introuvables.');
  const scriptsCommuns = accueil.slice(accueil.indexOf('</footer>') + '</footer>'.length, accueil.lastIndexOf('</body>'));
  for (const r of ressources) if (new URL(r.url).protocol !== 'https:') throw new Error('Lien de ressource non HTTPS.');
  const guides = ressources.filter(r => r.type !== 'communautaire');
  const organismes = ressources.filter(r => r.type === 'communautaire');
  /* Date de la vérification de liens la plus récente, affichée dans l'avertissement. */
  const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const derniere = ressources.map(r => r.verifie).filter(Boolean).sort().pop();
  const dateVerif = derniere ? `${Number(derniere.slice(8, 10))}${derniere.slice(8, 10) === '01' ? '<sup>er</sup>' : ''} ${MOIS[Number(derniere.slice(5, 7)) - 1]} ${derniere.slice(0, 4)}` : '';

  /* Sections : sujets (ordre ORDRE_SUJETS) pour les guides, rubriques du bottin (ordre
     d'apparition) pour les organismes. */
  const rang = cat => (ORDRE_SUJETS.includes(cat) ? ORDRE_SUJETS.indexOf(cat) : ORDRE_SUJETS.length);
  const sujets = [...new Set(guides.map(r => r.cat))].sort((a, b) => rang(a) - rang(b));
  const rubriques = [...new Set(organismes.map(rubriqueDe))];
  const sectionsDe = (groupes, liste, cle, carte) => groupes.map((nom, index) => {
    const entries = liste.filter(r => cle(r) === nom);
    return `<section class="guides-band guides-category${index % 2 ? '' : ' guides-band--green'}" id="${ancre(nom)}" aria-labelledby="guides-category-${index}">
      <div class="guides-category-heading"><h2 id="guides-category-${index}">${esc(nom)}</h2><span class="compte" aria-label="${entries.length} ${entries.length > 1 ? 'ressources' : 'ressource'}">${entries.length}</span></div>
      <ul class="guides-resource-list">${entries.map(carte).join('\n')}</ul>
    </section>`;
  }).join('\n');

  /* Filtres propres à chaque page (attribut data-filtre = attribut data-* des fiches). */
  const parSujet = compter(guides, r => r.cat);
  const parOrganisme = compter(guides, r => r.org);
  const filtresGuides = `<label class="guides-select"><span>Sujet</span><select id="guides-filtre-sujet" data-filtre="category"><option value="">Tous les sujets</option>${sujets.map(c => option(c, c, parSujet.get(c))).join('')}</select></label>
        <label class="guides-select"><span>Organisme</span><select id="guides-filtre-organisme" data-filtre="org"><option value="">Tous les organismes</option>${trierFr([...parOrganisme.keys()]).map(o => option(o, o, parOrganisme.get(o))).join('')}</select></label>`;
  const parRubrique = new Map();
  organismes.forEach(r => [...new Set((r.rubriques || [r.rubrique]).map(x => x.split(' · ')[0]))].forEach(k => parRubrique.set(k, (parRubrique.get(k) || 0) + 1)));
  const villesEst = compter(organismes.filter(r => r.ville && !estHors(r)), villeDe);
  const villesHors = compter(organismes.filter(estHors), villeDe);
  const sansAdresse = organismes.filter(r => !r.ville).length;
  const filtresComm = `<label class="guides-select"><span>Type d’aide</span><select id="guides-filtre-rubrique" data-filtre="rubriques"><option value="">Tous les types d’aide</option>${rubriques.map(k => option(k, k, parRubrique.get(k))).join('')}</select></label>
        <label class="guides-select"><span>Ville</span><select id="guides-filtre-ville" data-filtre="ville"><option value="">Toutes les villes</option><optgroup label="Montérégie-Est">${trierFr([...villesEst.keys()]).map(v => option(v, v, villesEst.get(v))).join('')}</optgroup><optgroup label="Hors territoire">${trierFr([...villesHors.keys()]).map(v => option(v, v, villesHors.get(v))).join('')}</optgroup>${sansAdresse ? `<optgroup label="Autres">${option(SANS_ADRESSE, 'Lignes d’aide et services à distance', sansAdresse)}</optgroup>` : ''}</select></label>
        <label class="guides-case"><input type="checkbox" id="guides-hors"> Inclure les organismes hors territoire (${organismes.filter(estHors).length})</label>`;

  const page = cle => {
    const P = PAGES[cle];
    const autre = PAGES[cle === 'guides' ? 'communautaire' : 'guides'];
    const liste = cle === 'guides' ? guides : organismes;
    const n = liste.length;
    const url = 'https://trouvetaclinique.ca' + P.chemin;
    const onglets = ['guides', 'communautaire'].map(k => {
      const nb = k === 'guides' ? guides.length : organismes.length;
      return `<a href="${PAGES[k].chemin}"${k === cle ? ' aria-current="page"' : ''}>${PAGES[k].onglet} <span class="guides-onglet-compte">${nb}</span></a>`;
    }).join('');
    return `<!doctype html>
<html lang="fr-CA">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${P.titre}</title>
  <meta name="description" content="${P.description}">
  <link rel="canonical" href="${url}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta property="og:locale" content="fr_CA">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Trouve ta clinique">
  <meta property="og:title" content="${P.ogTitre}">
  <meta property="og:url" content="${url}">
  <meta property="og:description" content="${P.ogDescription}">
  <meta property="og:image" content="https://trouvetaclinique.ca/assets/og-guides.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${P.ogAlt}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://trouvetaclinique.ca/assets/og-guides.png">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: P.ogTitre,
    description: P.ldDescription,
    url,
    inLanguage: 'fr-CA',
    isPartOf: { '@type': 'WebSite', name: 'Trouve ta clinique', url: 'https://trouvetaclinique.ca/' },
    mainEntity: { '@type': 'ItemList', numberOfItems: n }
  }).replace(/</g, '\\u003c')}</script>
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="apple-touch-icon" href="/guides/apple-touch-icon.png">
  <link rel="manifest" href="/guides/manifest.webmanifest">
  <meta name="theme-color" content="#08A0A0">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="Guides">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <link rel="stylesheet" href="/assets/seo-pages.css?v=88-interface">
  <link rel="stylesheet" href="/assets/guides-cliniques.css?v=104-deux-pages">
  <script src="/assets/guides-recherche.js?v=104-deux-pages" defer></script>
  <script src="/assets/guides-cliniques.js?v=104-deux-pages" defer></script>
  <script src="/assets/guides-installer.js?v=104-deux-pages" defer></script>${URL_AIGUILLAGE ? `
  <script src="/assets/guides-aiguillage.js?v=104-deux-pages" defer></script>` : ''}
</head>
<body class="guides-page" data-page="${cle}" data-mot="${P.mot}" data-autre-page="${autre.chemin}">
<a class="skip-link" href="#contenu">Aller au contenu</a>
${header.replace(/ aria-current="page"/g, '')}
<main id="contenu" class="guides-main">
  <nav class="guides-band guides-onglets" aria-label="Catalogue">${onglets}</nav>
  <section class="guides-band guides-intro">
    <p class="eyebrow">${P.eyebrow}</p>
    <h1>${P.h1}</h1>
    <p class="lead">${P.lead}</p>
    ${cle === 'guides'
      ? `<p class="guides-avis">Les guides appartiennent à leurs organismes et peuvent changer : consultez toujours la version en vigueur sur leur site.${dateVerif ? ` Liens vérifiés le ${dateVerif}.` : ''} Ce catalogue ne remplace pas le jugement clinique.</p>`
      : `<p class="guides-avis">${NOTE_COMMUNAUTAIRE}</p>`}
    <div class="guides-app" id="guides-app" hidden>
      <button type="button" class="guides-app-bouton" id="guides-app-installer"><img src="/guides/icon-192.png" width="28" height="28" alt=""> Installer l’app Guides</button>
      <span class="guides-app-note">Accès direct depuis l’écran d’accueil, même hors connexion.</span>
      <p class="guides-app-aide" id="guides-app-aide" role="status" hidden></p>
    </div>
  </section>
  <section class="guides-band guides-band--green guides-search" aria-labelledby="guides-search-title">
    <h2 id="guides-search-title">${P.rechercheTitre}</h2>
    <form class="search-page-form guides-search-form" role="search" aria-label="${P.rechercheEtiquette}" action="${P.chemin}" method="get">
      <label class="visually-hidden" for="guide-search">${P.placeholder.replace('…', '')}</label>
      <input id="guide-search" name="q" type="search" placeholder="${P.placeholder}" autocomplete="off" aria-controls="guides-catalogue">
      <button type="submit">Rechercher</button>
    </form>
    <p class="guides-search-hint">${P.aide}</p>
    <div class="guides-filter-area" hidden>
      <h3 id="guides-filter-title">Filtrer</h3>
      <div class="guides-filters" role="group" aria-labelledby="guides-filter-title">
        ${cle === 'guides' ? filtresGuides : filtresComm}
        <button class="guides-filtres-reset" type="button" hidden>Effacer les filtres</button>
      </div>
    </div>
    <p class="guides-status" id="guide-status" role="status" aria-live="polite" aria-atomic="true">${n} ${P.mot}s dans le catalogue</p>
    <p class="guides-autre" hidden><a href="${autre.chemin}"></a></p>
${cle === 'guides' ? `    <div class="guides-communautaire" hidden>
      <p><strong>Vous cherchez un organisme&nbsp;?</strong> Consultez les <a href="${autre.chemin}">ressources communautaires</a> : ${organismes.length} organismes et lignes d’aide, par ville et par type d’aide. Téléphonez avant de diriger quelqu’un.</p>
      <p>Ailleurs en Montérégie, le 211 répertorie les organismes près de chez vous : composez le <a href="tel:211">2-1-1</a> ou consultez <a href="https://www.211qc.ca/" target="_blank" rel="noopener noreferrer">211qc.ca<span class="visually-hidden"> (nouvel onglet)</span></a>.<br>En cas de détresse psychosociale : Info-Social <a href="tel:811">811</a>, option 2.</p>
    </div>
` : ''}    <noscript><p>La recherche nécessite JavaScript. Vous pouvez consulter toute la liste ci-dessous.</p></noscript>
  </section>
${URL_AIGUILLAGE ? `  <section class="guides-band guides-ia" aria-labelledby="guides-ia-titre" data-url="${esc(URL_AIGUILLAGE)}" data-page="${cle}" hidden>
    <p class="guides-ia-pastille"><span aria-hidden="true">✦</span> Nouveau : recherche assistée par IA</p>
    <h2 id="guides-ia-titre">${P.iaTitre}</h2>
    <p class="guides-ia-intro">${P.iaIntro}</p>
    <form class="guides-ia-form">
      <label class="visually-hidden" for="guides-ia-question">Situation ou question</label>
      <textarea id="guides-ia-question" name="question" rows="2" maxlength="400" placeholder="${P.iaExemple}" required></textarea>
      <button type="submit">Obtenir des suggestions</button>
    </form>
    <p class="guides-ia-avis"><strong>Confidentialité :</strong> votre question est transmise à un service d’IA (Anthropic) pour être traitée, puis n’est pas conservée par ce site. N’y inscrivez aucun renseignement permettant d’identifier un patient.</p>
    <div class="guides-ia-resultat" aria-live="polite"></div>
  </section>
` : ''}  <section class="guides-band guides-favoris" aria-labelledby="guides-favoris-titre" hidden>
    <div class="guides-category-heading"><h2 id="guides-favoris-titre">Mes favoris</h2><span class="compte"></span></div>
    <p class="guides-favoris-note">Vos favoris sont gardés dans ce navigateur seulement : ils ne se synchronisent pas entre votre cellulaire et votre ordinateur.</p>
    <ul class="guides-resource-list"></ul>
  </section>
  <section class="guides-band guides-resultats" aria-labelledby="guides-resultats-titre" hidden>
    <div class="guides-category-heading"><h2 id="guides-resultats-titre">Résultats les plus pertinents</h2><span class="compte"></span></div>
    <ul class="guides-resource-list"></ul>
  </section>
  <div id="guides-catalogue">
    <h2 class="guides-catalogue-titre" id="guides-catalogue-titre">${P.catalogueTitre}</h2>
${cle === 'guides' ? sectionsDe(sujets, guides, r => r.cat, carteGuide) : sectionsDe(rubriques, organismes, rubriqueDe, carteCommunautaire)}</div>
  <section class="guides-band guides-empty" hidden>
    <h2>Aucun résultat</h2>
    <p>Essayez un autre mot-clé, retirez un filtre ou consultez toute la liste.</p>
    <button class="btn guides-reset" type="button">Tout afficher</button>
  </section>
  <section class="guides-band guides-proposer" aria-labelledby="guides-proposer-titre">
    <h2 id="guides-proposer-titre">Il manque ${cle === 'guides' ? 'un guide' : 'un organisme'}&nbsp;?</h2>
    <p>${P.proposerTexte}</p>
    <a class="guides-proposer-bouton" href="${esc(PROPOSITION_HREF)}">Proposer un guide ou une ressource</a>
  </section>
</main>
${footer}
${scriptsCommuns}
</body>
</html>
`;
  };
  fs.writeFileSync(path.join(racine, 'guides/index.html'), page('guides'));
  fs.mkdirSync(path.join(racine, 'guides/ressources-communautaires'), { recursive: true });
  fs.writeFileSync(path.join(racine, 'guides/ressources-communautaires/index.html'), page('communautaire'));
  return { guides: guides.length, organismes: organismes.length, sujets: sujets.length, rubriques: rubriques.length };
}

module.exports = { genererGuidesCliniques, ORDRE_SUJETS, PAGES };
if (require.main === module) console.log(genererGuidesCliniques());
