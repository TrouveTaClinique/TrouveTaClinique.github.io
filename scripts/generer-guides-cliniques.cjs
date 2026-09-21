'use strict';

// Le catalogue réutilise l'en-tête, le pied et les comportements de l'accueil.
// Appelé après sa génération, pour suivre automatiquement les composants communs.
const fs = require('node:fs');
const path = require('node:path');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

function genererGuidesCliniques(racine = path.resolve(__dirname, '..')) {
  const accueil = fs.readFileSync(path.join(racine, 'index.html'), 'utf8');
  const ressources = JSON.parse(fs.readFileSync(path.join(racine, 'guides/donnees.json'), 'utf8'));
  const header = accueil.match(/<header class="site">[\s\S]*?<\/header>/)?.[0];
  const footer = accueil.match(/<footer class="pied-site">[\s\S]*?<\/footer>/)?.[0];
  if (!header || !footer) throw new Error('Composants communs de l’accueil introuvables.');
  const scriptsCommuns = accueil.slice(accueil.indexOf('</footer>') + '</footer>'.length, accueil.lastIndexOf('</body>'));
  const categories = [...new Set(ressources.map(r => r.cat))];
  const titres = [];
  const sections = categories.map((cat, index) => {
    const entries = ressources.map((r, i) => ({...r, id:i})).filter(r => r.cat === cat);
    const cards = entries.map(r => {
      if (new URL(r.url).protocol !== 'https:') throw new Error('Lien de ressource non HTTPS.');
      titres.push(r.title);
      return `<li class="guides-resource" data-category="${esc(cat)}" data-search="${esc([r.title,r.org,r.cat,r.tags,r.desc].join(' '))}">
        <a class="guides-resource-link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">
          <span class="guides-resource-source">${esc(r.org)}</span>
          <h3>${esc(r.title)}</h3>
          <span class="guides-keywords">${esc(r.tags)}</span>
          <span class="guides-resource-arrow" aria-hidden="true">↗</span>
          <span class="visually-hidden"> (nouvel onglet)</span>
        </a>
      </li>`;
    }).join('\n');
    return `<section class="guides-band guides-category${index % 2 ? ' guides-band--green' : ''}" aria-labelledby="guides-category-${index}">
      <div class="guides-category-heading"><h2 id="guides-category-${index}">${esc(cat)}</h2><span class="compte" aria-label="${entries.length} ressource${entries.length > 1 ? 's' : ''}">${entries.length}</span></div>
      <ul class="guides-resource-list">${cards}</ul>
    </section>`;
  }).join('\n');
  const options = ['Toutes', ...categories].map(cat => `<button class="guides-filter" type="button" data-category="${esc(cat)}" aria-pressed="${cat === 'Toutes'}">${esc(cat)}</button>`).join('\n');
  const html = `<!doctype html>
<html lang="fr-CA">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Guides de pratique pour la première ligne | Trouve ta clinique</title>
  <meta name="description" content="Retrouvez les guides de pratique, algorithmes et ressources pour la médecine familiale. Recherchez par sujet ou organisme et consultez les sources originales.">
  <link rel="canonical" href="https://trouvetaclinique.ca/guides/">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta property="og:locale" content="fr_CA">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Trouve ta clinique">
  <meta property="og:title" content="Guides pratiques et ressources cliniques">
  <meta property="og:url" content="https://trouvetaclinique.ca/guides/">
  <link rel="icon" type="image/png" href="/assets/logo-banniere.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
  <link rel="stylesheet" href="/assets/seo-pages.css?v=88-interface">
  <link rel="stylesheet" href="/assets/guides-cliniques.css?v=89-guides-theme">
  <script src="/assets/guides-cliniques.js?v=89-guides-theme" defer></script>
</head>
<body class="guides-page">
<a class="skip-link" href="#contenu">Aller au contenu</a>
${header.replace(/ aria-current="page"/g, '')}
<main id="contenu" class="guides-main">
  <section class="guides-band guides-intro">
    <p class="eyebrow">Médecine familiale · Première ligne</p>
    <h1>Guides pratiques et ressources cliniques</h1>
    <p class="lead">Retrouvez les guides de pratique, algorithmes et ressources utiles à la médecine familiale, puis consultez directement leur site d’origine.</p>
  </section>
  <section class="guides-band guides-band--green guides-search" aria-labelledby="guides-search-title">
    <h2 id="guides-search-title">Quelle ressource cherchez-vous&nbsp;?</h2>
    <form class="search-page-form guides-search-form" role="search" aria-label="Rechercher une ressource clinique" action="/guides/" method="get">
      <label class="visually-hidden" for="guide-search">Sujet, organisme ou mot-clé</label>
      <input id="guide-search" name="q" type="search" placeholder="Sujet, organisme ou mot-clé…" autocomplete="off" aria-controls="guides-catalogue">
      <button type="submit">Rechercher</button>
    </form>
    <p class="guides-search-hint">Par exemple : INESSS, vaccination, pédiatrie.</p>
    <div class="guides-filter-area" hidden>
      <h3 id="guides-filter-title">Parcourir par catégorie</h3>
      <div class="guides-filters" role="group" aria-labelledby="guides-filter-title">${options}</div>
    </div>
    <p class="guides-status" id="guide-status" role="status" aria-live="polite" aria-atomic="true">${ressources.length} ressources dans le catalogue</p>
    <noscript><p>La recherche nécessite JavaScript. Vous pouvez consulter toutes les ressources ci-dessous.</p></noscript>
  </section>
  <div id="guides-catalogue">${sections}</div>
  <section class="guides-band guides-empty" hidden>
    <h2>Aucune ressource trouvée</h2>
    <p>Essayez un autre mot-clé ou consultez l’ensemble du catalogue.</p>
    <button class="btn guides-reset" type="button">Afficher toutes les ressources</button>
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

module.exports = { genererGuidesCliniques };
if (require.main === module) console.log(genererGuidesCliniques());
