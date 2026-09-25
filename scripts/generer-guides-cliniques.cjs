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
/* Sujet des organismes communautaires (fiches « type: communautaire » de guides/donnees.json). */
const SUJET_COMMUNAUTAIRE = 'Ressources communautaires';
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

function carteCommunautaire(r) {
  /* Rubrique principale et ses sous-rubriques (ex. « Hébergement · Femmes, Hommes »). */
  const [section] = r.rubrique.split(' · ');
  const sous = (r.rubriques || []).filter(x => x.startsWith(section + ' · ')).map(x => x.split(' · ')[1]);
  const lieu = [section + (sous.length ? ' · ' + sous.join(', ') : ''), r.ville].filter(Boolean).join(' · ');
  const details = [['Pour qui', r.pourQui], ['Heures', r.heures], ['Accès', r.acces]].filter(([, v]) => v);
  return `<li class="guides-resource guides-resource--comm" data-id="${esc(r.url)}" data-type="communautaire" data-title="${esc(r.title)}" data-org="${esc(r.org)}" data-desc="${esc(r.desc || '')}" data-category="${esc(r.cat)}" data-rubriques="${esc((r.rubriques || []).join(' '))}" data-ville="${esc(r.ville || '')}" data-tags="${esc(r.tags)}">
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

function genererGuidesCliniques(racine = path.resolve(__dirname, '..')) {
  const accueil = fs.readFileSync(path.join(racine, 'index.html'), 'utf8');
  const ressources = JSON.parse(fs.readFileSync(path.join(racine, 'guides/donnees.json'), 'utf8'));
  const header = accueil.match(/<header class="site">[\s\S]*?<\/header>/)?.[0];
  const footer = accueil.match(/<footer class="pied-site">[\s\S]*?<\/footer>/)?.[0];
  if (!header || !footer) throw new Error('Composants communs de l’accueil introuvables.');
  const scriptsCommuns = accueil.slice(accueil.indexOf('</footer>') + '</footer>'.length, accueil.lastIndexOf('</body>'));
  const rang = cat => (ORDRE_SUJETS.includes(cat) ? ORDRE_SUJETS.indexOf(cat) : ORDRE_SUJETS.length);
  const categories = [...new Set(ressources.map(r => r.cat))].sort((a, b) => rang(a) - rang(b));
  /* Date de la vérification de liens la plus récente, affichée dans l'avertissement. */
  const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const derniere = ressources.map(r => r.verifie).filter(Boolean).sort().pop();
  const dateVerif = derniere ? `${Number(derniere.slice(8, 10))}${derniere.slice(8, 10) === '01' ? '<sup>er</sup>' : ''} ${MOIS[Number(derniere.slice(5, 7)) - 1]} ${derniere.slice(0, 4)}` : '';
  const titres = [];
  const sections = categories.map((cat, index) => {
    const entries = ressources.map((r, i) => ({...r, id:i})).filter(r => r.cat === cat);
    const cards = entries.map(r => {
      if (new URL(r.url).protocol !== 'https:') throw new Error('Lien de ressource non HTTPS.');
      titres.push(r.title);
      if (r.type === 'communautaire') return carteCommunautaire(r);
      return `<li class="guides-resource" data-tags="${esc(r.tags)}" data-id="${esc(r.url)}" data-title="${esc(r.title)}" data-org="${esc(r.org)}" data-desc="${esc(r.desc || '')}" data-category="${esc(cat)}" data-search="${esc([r.title,r.org,r.cat,r.tags,r.desc].join(' '))}">
        <a class="guides-resource-link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">
          <span class="guides-resource-source">${esc(r.org)}</span>
          <h3>${esc(r.title)}</h3>
          <span class="guides-keywords">${esc(r.tags)}</span>
          <span class="guides-resource-arrow" aria-hidden="true">↗</span>
          <span class="visually-hidden"> (nouvel onglet)</span>
        </a>
      </li>`;
    }).join('\n');
    return `<section class="guides-band guides-category${index % 2 ? '' : ' guides-band--green'}" id="${ancre(cat)}" aria-labelledby="guides-category-${index}">
      <div class="guides-category-heading"><h2 id="guides-category-${index}">${esc(cat)}</h2><span class="compte" aria-label="${entries.length} ressource${entries.length > 1 ? 's' : ''}">${entries.length}</span></div>
      ${cat === SUJET_COMMUNAUTAIRE ? `<p class="guides-comm-note">Organismes surtout de l’agglomération de Longueuil, tirés du <a href="${SOURCE_COMMUNAUTAIRE}" target="_blank" rel="noopener noreferrer">bottin de ressources 2023 du Réseau d’habitations chez soi<span class="visually-hidden"> (nouvel onglet)</span></a>. Les heures et les conditions peuvent avoir changé : téléphonez avant de diriger quelqu’un.<br>Ailleurs en Montérégie : <a href="https://www.211qc.ca/" target="_blank" rel="noopener noreferrer">211<span class="visually-hidden"> (nouvel onglet)</span></a> (composez le <a href="tel:211">2-1-1</a>).</p>` : ''}
      <ul class="guides-resource-list">${cards}</ul>
    </section>`;
  }).join('\n');
  const compter = cle => ressources.reduce((m, r) => m.set(r[cle], (m.get(r[cle]) || 0) + 1), new Map());
  const parCategorie = compter('cat');
  const parOrganisme = compter('org');
  const optionsSujet = categories.map(cat => `<option value="${esc(cat)}">${esc(cat)} (${parCategorie.get(cat)})</option>`).join('');
  const organismes = [...parOrganisme.keys()].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  const optionsOrganisme = organismes.map(org => `<option value="${esc(org)}">${esc(org)} (${parOrganisme.get(org)})</option>`).join('');
  const html = `<!doctype html>
<html lang="fr-CA">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Guides de pratique pour la première ligne | Trouve ta clinique</title>
  <meta name="description" content="Guides de pratique, algorithmes et ressources communautaires pour la médecine familiale en Montérégie. Recherchez par sujet ou organisme et consultez les sources originales.">
  <link rel="canonical" href="https://trouvetaclinique.ca/guides/">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta property="og:locale" content="fr_CA">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Trouve ta clinique">
  <meta property="og:title" content="Guides pratiques et ressources cliniques">
  <meta property="og:url" content="https://trouvetaclinique.ca/guides/">
  <meta property="og:description" content="Guides de pratique, algorithmes et ressources pour la médecine familiale, classés par sujet et par organisme, avec un lien direct vers la source originale.">
  <meta property="og:image" content="https://trouvetaclinique.ca/assets/og-accueil.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Guides pratiques et ressources cliniques',
    description: 'Catalogue de guides de pratique, algorithmes et ressources pour la médecine familiale en première ligne.',
    url: 'https://trouvetaclinique.ca/guides/',
    inLanguage: 'fr-CA',
    isPartOf: { '@type': 'WebSite', name: 'Trouve ta clinique', url: 'https://trouvetaclinique.ca/' },
    mainEntity: { '@type': 'ItemList', numberOfItems: ressources.length }
  }).replace(/</g, '\\u003c')}</script>
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
  <link rel="stylesheet" href="/assets/seo-pages.css?v=88-interface">
  <link rel="stylesheet" href="/assets/guides-cliniques.css?v=98-sujets-fermes">
  <script src="/assets/guides-recherche.js?v=98-sujets-fermes" defer></script>
  <script src="/assets/guides-cliniques.js?v=98-sujets-fermes" defer></script>${URL_AIGUILLAGE ? `
  <script src="/assets/guides-aiguillage.js?v=98-sujets-fermes" defer></script>` : ''}
</head>
<body class="guides-page">
<a class="skip-link" href="#contenu">Aller au contenu</a>
${header.replace(/ aria-current="page"/g, '')}
<main id="contenu" class="guides-main">
  <section class="guides-band guides-intro">
    <p class="eyebrow">Médecine familiale · Première ligne</p>
    <h1>Guides pratiques et ressources cliniques</h1>
    <p class="lead">Retrouvez les guides de pratique, algorithmes et ressources utiles à la médecine familiale, ainsi que des organismes communautaires vers qui diriger vos patients.</p>
    <p class="guides-avis">Les guides appartiennent à leurs organismes et peuvent changer : consultez toujours la version en vigueur sur leur site.${dateVerif ? ` Liens vérifiés le ${dateVerif}.` : ''} Ce catalogue ne remplace pas le jugement clinique.</p>
  </section>
  <section class="guides-band guides-band--green guides-search" aria-labelledby="guides-search-title">
    <h2 id="guides-search-title">Quelle ressource cherchez-vous&nbsp;?</h2>
    <form class="search-page-form guides-search-form" role="search" aria-label="Rechercher une ressource clinique" action="/guides/" method="get">
      <label class="visually-hidden" for="guide-search">Sujet, organisme ou mot-clé</label>
      <input id="guide-search" name="q" type="search" placeholder="Sujet, organisme ou mot-clé…" autocomplete="off" aria-controls="guides-catalogue">
      <button type="submit">Rechercher</button>
    </form>
    <p class="guides-search-hint">Mots-clés ou phrase complète, par exemple : MPOC, otite chez un enfant allergique, patient sous apixaban. Les abréviations, synonymes et fautes de frappe courantes sont reconnus.</p>
    <div class="guides-filter-area" hidden>
      <h3 id="guides-filter-title">Filtrer</h3>
      <div class="guides-filters" role="group" aria-labelledby="guides-filter-title">
        <label class="guides-select"><span>Sujet</span><select id="guides-filtre-sujet"><option value="">Tous les sujets</option>${optionsSujet}</select></label>
        <label class="guides-select"><span>Organisme</span><select id="guides-filtre-organisme"><option value="">Tous les organismes</option>${optionsOrganisme}</select></label>
        <button class="guides-filtres-reset" type="button" hidden>Effacer les filtres</button>
      </div>
    </div>
    <p class="guides-status" id="guide-status" role="status" aria-live="polite" aria-atomic="true">${ressources.length} ressources dans le catalogue</p>
    <div class="guides-communautaire" hidden>
      <p><strong>Ressources communautaires :</strong> les organismes du catalogue viennent surtout de l’agglomération de Longueuil (bottin 2023). Téléphonez avant de diriger quelqu’un.</p>
      <p>Ailleurs en Montérégie, le 211 répertorie les organismes près de chez vous : composez le <a href="tel:211">2-1-1</a> ou consultez <a href="https://www.211qc.ca/" target="_blank" rel="noopener noreferrer">211qc.ca<span class="visually-hidden"> (nouvel onglet)</span></a>.<br>En cas de détresse psychosociale : Info-Social <a href="tel:811">811</a>, option 2.</p>
    </div>
    <noscript><p>La recherche nécessite JavaScript. Vous pouvez consulter toutes les ressources ci-dessous.</p></noscript>
  </section>
${URL_AIGUILLAGE ? `  <section class="guides-band guides-ia" aria-labelledby="guides-ia-titre" data-url="${esc(URL_AIGUILLAGE)}" hidden>
    <p class="guides-ia-pastille"><span aria-hidden="true">✦</span> Nouveau : recherche assistée par IA</p>
    <h2 id="guides-ia-titre">Demandez à l’IA quel guide ou quelle ressource consulter</h2>
    <p class="guides-ia-intro">Décrivez la situation en quelques mots : l’IA suggère jusqu’à 5 guides ou organismes communautaires du catalogue et explique chaque choix. Elle ne donne pas d’avis clinique.</p>
    <form class="guides-ia-form">
      <label class="visually-hidden" for="guides-ia-question">Situation ou question</label>
      <textarea id="guides-ia-question" name="question" rows="2" maxlength="400" placeholder="Ex. : toux depuis 4 semaines chez un fumeur de 60 ans" required></textarea>
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
    <h2 class="guides-catalogue-titre" id="guides-catalogue-titre">Parcourir par sujet</h2>
${sections}</div>
  <section class="guides-band guides-empty" hidden>
    <h2>Aucune ressource trouvée</h2>
    <p>Essayez un autre mot-clé ou consultez l’ensemble du catalogue.</p>
    <button class="btn guides-reset" type="button">Afficher toutes les ressources</button>
  </section>
  <section class="guides-band guides-proposer" aria-labelledby="guides-proposer-titre">
    <h2 id="guides-proposer-titre">Il manque un guide ou une ressource&nbsp;?</h2>
    <p>Proposez un guide de pratique, un outil clinique ou une ressource utile en première ligne : il sera vérifié avant d’être ajouté au catalogue.</p>
    <a class="guides-proposer-bouton" href="${esc(PROPOSITION_HREF)}">Proposer un guide ou une ressource</a>
  </section>
</main>
${footer}
${scriptsCommuns}
</body>
</html>
`;
  fs.writeFileSync(path.join(racine, 'guides/index.html'), html);
  return {ressources:ressources.length, categories:categories.length};
}

module.exports = { genererGuidesCliniques, ORDRE_SUJETS };
if (require.main === module) console.log(genererGuidesCliniques());
