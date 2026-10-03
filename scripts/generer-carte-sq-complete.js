#!/usr/bin/env node
/*
 * Carte de toute la Montérégie, dans le thème Santé Québec (3 oct. 2026 : remplace l'ancienne
 * carte complète et les cartes Centre et Ouest). Lit le gabarit Est (sans le modifier).
 * publier-regions.js l'écrit dans monteregie/index.html, avec le répertoire texte en dessous.
 * L'ancienne adresse /carte-interactive/ devient un simple renvoi vers /monteregie/.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const GABARIT = path.join(__dirname, 'carte-est-sq.template.html');
const SORTIE_RENVOI = path.join(RACINE, 'carte-interactive', 'index.html');
const URL_CARTE = 'https://trouvetaclinique.ca/monteregie/';

const HRR = 'Haut-Richelieu\u2013Rouville';
const SUROIT = 'du Suro\u00eet';

function uneFois(html, ancien, nouveau, libelle) {
  const n = html.split(ancien).length - 1;
  if (n !== 1) throw new Error((libelle || ancien.slice(0, 60)) + ' : ' + n + ' occurrence(s), 1 attendue.');
  return html.replace(ancien, nouveau);
}

function head() {
  return `<!DOCTYPE html>
<html lang="fr-CA" data-region="Est">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Carte de la Montérégie : cliniques en recrutement</title>
<meta name="description" content="Carte interactive des cliniques et établissements de la Montérégie (Est, Centre et Ouest), pour préparer votre PTEM 2027.">
<link rel="canonical" href="${URL_CARTE}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Trouve ta clinique">
<meta property="og:locale" content="fr_CA">
<meta property="og:url" content="${URL_CARTE}">
<meta property="og:title" content="Carte de la Montérégie | Trouve ta clinique">
<meta property="og:description" content="Carte interactive des cliniques en recrutement et des établissements de la Montérégie.">
<meta property="og:image" content="https://trouvetaclinique.ca/assets/og-image-accueil.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Carte des cliniques en recrutement de la Montérégie · Trouve ta clinique.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Carte de la Montérégie | Trouve ta clinique">
<meta name="twitter:description" content="Carte interactive des cliniques en recrutement et des établissements de la Montérégie.">
<meta name="twitter:image" content="https://trouvetaclinique.ca/assets/og-image-accueil.png">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": "${URL_CARTE}#webpage",
  "name": "Trouve ta clinique · Carte de la Montérégie",
  "url": "${URL_CARTE}",
  "inLanguage": "fr-CA",
  "description": "Carte interactive des cliniques en recrutement médical et des établissements de la Montérégie (Est, Centre et Ouest).",
  "isPartOf": { "@id": "https://trouvetaclinique.ca/#website" },
  "about": {
    "@type": "Place",
    "name": "Montérégie",
    "address": { "@type": "PostalAddress", "addressRegion": "QC", "addressCountry": "CA" }
  }
}
</script>
<meta name="theme-color" content="#170A72">
<script>
// Pas de PWA ici : retire un ancien service worker de portée « / » qui contrôlerait la page.
if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
  navigator.serviceWorker.getRegistrations().then(function (liste) {
    liste.forEach(function (enr) {
      try { if (new URL(enr.scope).pathname === '/') enr.unregister(); } catch (e) {}
    });
  }).catch(function () {});
}
</script>
<link rel="icon" type="image/png" sizes="32x32" href="../favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="../favicon-16.png">
<link rel="icon" type="image/png" sizes="48x48" href="../favicon-48.png">
<link rel="stylesheet" href="../leaflet.css">
<link rel="stylesheet" href="../vendor/maplibre-gl.css">
<link rel="preconnect" href="https://basemaps.cartocdn.com" crossorigin>
<link rel="preconnect" href="https://tiles.basemaps.cartocdn.com" crossorigin>
`;
}

/* Ancienne adresse de la carte : renvoi immédiat, en gardant ?c=, ?mode=, etc. */
function pageRenvoi() {
  return `<!DOCTYPE html>
<html lang="fr-CA">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Carte de la Montérégie | Trouve ta clinique</title>
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${URL_CARTE}">
<meta http-equiv="refresh" content="0; url=/monteregie/">
<script>location.replace('/monteregie/' + location.search + location.hash);</script>
</head>
<body>
<p>La carte a déménagé : <a href="/monteregie/">carte de la Montérégie</a>.</p>
</body>
</html>
`;
}

function generer() {
  let html = fs.readFileSync(GABARIT, 'utf8').replace(/\r\n/g, '\n');
  if (/kaushan/i.test(html)) throw new Error('Kaushan Script est présent dans le gabarit SQ.');
  if (!html.includes('--app-pin:') || !html.includes('--app-logo:')) {
    throw new Error('Le gabarit SQ ne contient plus --app-pin ou --app-logo.');
  }

  html = head() + html;

  html = uneFois(html,
    '.dp-name-display:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }\n</style>',
    '.dp-name-display:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }\n' +
    '.rls-legend { max-height: 46vh; overflow: auto; }\n' +
    '.reg-filter { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-top:12px; }\n' +
    '.reg-chip { font-size:12px; font-weight:600; letter-spacing:.02em; padding:8px 4px; border-radius:999px;\n' +
    '  text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;\n' +
    '  border:1.5px solid var(--c); color:var(--c); background:var(--champ); cursor:pointer; font-family: var(--sq-font); transition:all .15s; }\n' +
    '.reg-chip:hover { opacity:.72; }\n' +
    '.reg-chip.on { background:color-mix(in srgb, var(--c) 78%, #000); color:#fff; }\n' +
    '.rls-filter { margin-top:8px; width:100%; box-sizing:border-box; padding:8px 10px; border:1.5px solid var(--navy);\n' +
    '  border-radius:9px; font-family: var(--sq-font); font-size:13px; background:var(--champ); color:var(--texte); cursor:pointer; }\n' +
    '.rls-filter:focus { outline:none; border-color:var(--blue); box-shadow:0 0 0 3px rgba(0,128,215,.16); }\n' +
    '</style>',
    'légende');

  html = uneFois(html,
    '<span class="ldr-mot">Est</span>',
    '<span class="ldr-mot">complète</span>',
    'écran de chargement');

  html = uneFois(html,
    '<strong>Montérégie<span class="brand-tiret">-</span><span class="brand-mot">Est</span></strong>',
    '<strong>Montérégie</strong>',
    'en-tête');

  html = uneFois(html,
    '    <button class="btn-install" id="btn-install">⤓ <span class="btn-install-label">Installer la carte Montérégie-Est</span></button>\n',
    '',
    'bouton installer');

  html = uneFois(html,
    `      <a class="info-menu-link" role="menuitem" href="https://www.santemonteregie.qc.ca/est/recrutement-medical-monteregie-est" target="_blank" rel="noopener">
        <span class="info-menu-ic">i</span> À propos du recrutement
      </a>
      <hr>
      <a class="info-menu-link" role="menuitem" href="rls/pierre-boucher/">
        <span class="info-menu-ic" style="background:#0080D7">📋</span> Cliniques : RLS Pierre-Boucher
      </a>
      <a class="info-menu-link" role="menuitem" href="rls/richelieu-yamaska/">
        <span class="info-menu-ic" style="background:#08A0A0">📋</span> Cliniques : RLS Richelieu-Yamaska
      </a>
      <a class="info-menu-link" role="menuitem" href="rls/pierre-de-saurel/">
        <span class="info-menu-ic" style="background:#170A72">📋</span> Cliniques : RLS Pierre-De Saurel
      </a>
      <hr>
      <a class="info-menu-link" role="menuitem" href="ptem/">
        <span class="info-menu-ic">📘</span> Guide PTEM 2027
      </a>
      <a class="info-menu-link" role="menuitem" href="amp/">
        <span class="info-menu-ic">📗</span> Guide des AMP
      </a>
      <a class="info-menu-link" role="menuitem" href="video/">
        <span class="info-menu-ic">▶</span> La carte en vidéo (4 min)
      </a>
      <hr>
      <button type="button" class="info-menu-link" role="menuitem" id="info-menu-install">
        <span class="info-menu-ic">⤓</span> Installer la carte Montérégie-Est
      </button>`,
    `      <a class="info-menu-link" role="menuitem" href="https://www.santemonteregie.qc.ca/qui-sommes-nous-dtmf-monteregie#MenuDTMF" target="_blank" rel="noopener">
        <span class="info-menu-ic">i</span> DTMF Montérégie
      </a>
      <hr>
      <a class="info-menu-link" role="menuitem" href="/monteregie-est/ptem/">
        <span class="info-menu-ic">📘</span> Guide PTEM 2027
      </a>
      <a class="info-menu-link" role="menuitem" href="/monteregie-est/amp/">
        <span class="info-menu-ic">📗</span> Guide des AMP
      </a>
      <a class="info-menu-link" role="menuitem" href="/guides/">
        <span class="info-menu-ic">📚</span> Guides cliniques
      </a>
      <hr>
      <a class="info-menu-link" role="menuitem" href="/monteregie-est/">
        <span class="info-menu-ic" style="background:#0080D7">🗺</span> Carte Montérégie-Est
      </a>
      <a class="info-menu-link" role="menuitem" href="/monteregie-centre/">
        <span class="info-menu-ic" style="background:#08A0A0">📋</span> Territoire Montérégie-Centre
      </a>
      <a class="info-menu-link" role="menuitem" href="/monteregie-ouest/">
        <span class="info-menu-ic" style="background:#170A72">📋</span> Territoire Montérégie-Ouest
      </a>`,
    'menu');

  html = uneFois(html,
    '<h1 class="sr-only" id="page-h1">Trouve ta clinique · Cliniques en recrutement en Montérégie-Est</h1>\n<p class="sr-only" id="page-desc">\n  Carte interactive des cliniques et points de service qui recrutent des médecins de famille\n  en Montérégie-Est, dans les réseaux locaux de services Pierre-Boucher, Richelieu-Yamaska et Pierre-De Saurel. Pour chaque milieu :\n  coordonnées, type de clinique, réseau local de services, pratiques offertes, horaires et\n  personne-ressource pour le recrutement.\n</p>',
    '<h1 class="sr-only" id="page-h1">Trouve ta clinique · Cliniques en recrutement en Montérégie</h1>\n<p class="sr-only" id="page-desc">\n  Carte interactive des cliniques et des établissements de la Montérégie (Est, Centre et Ouest).\n  Pour chaque milieu : coordonnées, type de clinique, réseau local de services, pratiques offertes,\n  horaires et personne-ressource pour le recrutement.\n</p>',
    'titre accessible');

  html = uneFois(html,
    '<script src="../territoires-rls-est.js"></script>',
    '<script src="../territoires-rls-est.js"></script>\n<script src="../territoires-rls-centre-ouest.js"></script>',
    'territoires');

  html = uneFois(html,
    "document.title = prefix + 'Secteurs en recrutement : Montérégie-Est | Trouve ta clinique';",
    "document.title = prefix + 'Secteurs en recrutement : Montérégie | Trouve ta clinique';",
    'titre établissements');
  html = uneFois(html,
    "if (h1) h1.textContent = 'Trouve ta clinique · Secteurs en recrutement en Montérégie-Est';",
    "if (h1) h1.textContent = 'Trouve ta clinique · Secteurs en recrutement en Montérégie';",
    'h1 établissements');
  html = uneFois(html,
    "if (desc) desc.textContent = 'Carte interactive des secteurs en recrutement en établissement en Montérégie-Est, dans les réseaux locaux de services Pierre-Boucher, Richelieu-Yamaska et Pierre-De Saurel, et en mission régionale.';",
    "if (desc) desc.textContent = 'Carte interactive des secteurs en établissement de la Montérégie (Est, Centre et Ouest).';",
    'description établissements');
  html = uneFois(html,
    "document.title = prefix + 'Cliniques en recrutement : Montérégie-Est | Trouve ta clinique';",
    "document.title = prefix + 'Cliniques en recrutement : Montérégie | Trouve ta clinique';",
    'titre cliniques');
  html = uneFois(html,
    "if (h1) h1.textContent = 'Trouve ta clinique · Cliniques en recrutement en Montérégie-Est';",
    "if (h1) h1.textContent = 'Trouve ta clinique · Cliniques en recrutement en Montérégie';",
    'h1 cliniques');
  html = uneFois(html,
    "if (desc) desc.textContent = 'Carte interactive des cliniques et points de service qui recrutent des médecins de famille en Montérégie-Est, dans les réseaux locaux de services Pierre-Boucher, Richelieu-Yamaska et Pierre-De Saurel. Pour chaque milieu : coordonnées, type de clinique, réseau local de services, pratiques offertes, horaires et personne-ressource pour le recrutement.';",
    "if (desc) desc.textContent = 'Carte interactive des cliniques de la Montérégie (Est, Centre et Ouest).';",
    'description cliniques');

  html = uneFois(html,
    `const COULEURS_RLS_EST_SQ = {
  'Pierre-Boucher': '#0080D7',
  'Richelieu-Yamaska': '#08A0A0',
  'Pierre-De Saurel': '#170A72'
};`,
    `const COULEURS_RLS_EST_SQ = {
  'Pierre-Boucher': '#0080D7',
  'Richelieu-Yamaska': '#0080D7',
  'Pierre-De Saurel': '#0080D7',
  'Champlain': '#08A0A0',
  '${HRR}': '#08A0A0',
  'Jardins-Roussillon': '#170A72',
  'Vaudreuil-Soulanges': '#170A72',
  '${SUROIT}': '#170A72',
  'du Haut-Saint-Laurent': '#170A72'
};
const RLS_VERS_REGION = {
  'Pierre-Boucher': 'Est',
  'Richelieu-Yamaska': 'Est',
  'Pierre-De Saurel': 'Est',
  'Champlain': 'Centre',
  '${HRR}': 'Centre',
  'Jardins-Roussillon': 'Ouest',
  'Vaudreuil-Soulanges': 'Ouest',
  '${SUROIT}': 'Ouest',
  'du Haut-Saint-Laurent': 'Ouest'
};
const COULEURS_TERRITOIRE = { 'Est': '#0080D7', 'Centre': '#08A0A0', 'Ouest': '#170A72' };
const COULEURS_TERRITOIRE_PALES = { 'Est': '#A8DCF4', 'Centre': '#A7DFDC', 'Ouest': '#B8B1DF' };`,
    'couleurs des zones');

  html = uneFois(html,
    `    couchesRlsEstOfficielle.set(rls.nom, couche);
  });

}`,
    `    couchesRlsEstOfficielle.set(rls.nom, couche);
  });
  [window.TERRITOIRES_RLS_CENTRE_MSSS_2026, window.TERRITOIRES_RLS_OUEST_MSSS_2026].forEach(function (liste) {
    if (!Array.isArray(liste)) return;
    liste.forEach(function (rls) {
      if (couchesRlsEstOfficielle.has(rls.nom)) return;
      const couche = L.geoJSON({
        type: 'Feature',
        properties: { nom: rls.nom, code: rls.code, source: 'MSSS', version: '2026-04-01' },
        geometry: rls.geometry
      }, {
        pane: 'territoiresRlsEstFond',
        interactive: false,
        renderer: rlsFondRenderer,
        smoothFactor: 2,
        style: {
          color: COULEURS_RLS_EST_SQ[rls.nom] || rls.contour,
          opacity: 0.64,
          weight: 1.7,
          fillColor: COULEURS_RLS_EST_SQ[rls.nom] || rls.remplissage,
          fillOpacity: 0.19,
          lineJoin: 'round'
        }
      });
      couche.addTo(map);
      couchesRlsEstOfficielle.set(rls.nom, couche);
    });
  });

}`,
    'zones Centre et Ouest');

  html = uneFois(html,
    `const RLS_COLORS_REGION = {
  'Pierre-Boucher':    '#0080D7',
  'Richelieu-Yamaska': '#08A0A0',
  'Pierre-De Saurel':  '#170A72',
  'Régional':          '#6D28D9'
};
const RLS_COLORS_PALES_REGION = {
  'Pierre-Boucher':    '#A8DCF4',
  'Richelieu-Yamaska': '#A7DFDC',
  'Pierre-De Saurel':  '#B8B1DF',
  'Régional':          '#C4B5FD'
};`,
    `const RLS_COLORS_REGION = {
  'Pierre-Boucher':    '#0080D7',
  'Richelieu-Yamaska': '#0080D7',
  'Pierre-De Saurel':  '#0080D7',
  'Champlain':         '#08A0A0',
  '${HRR}': '#08A0A0',
  'Jardins-Roussillon': '#170A72',
  'Vaudreuil-Soulanges': '#170A72',
  '${SUROIT}': '#170A72',
  'du Haut-Saint-Laurent': '#170A72',
  'Régional':          '#0080D7'
};
const RLS_COLORS_PALES_REGION = {
  'Pierre-Boucher':    '#A8DCF4',
  'Richelieu-Yamaska': '#A8DCF4',
  'Pierre-De Saurel':  '#A8DCF4',
  'Champlain':         '#A7DFDC',
  '${HRR}': '#A7DFDC',
  'Jardins-Roussillon': '#B8B1DF',
  'Vaudreuil-Soulanges': '#B8B1DF',
  '${SUROIT}': '#B8B1DF',
  'du Haut-Saint-Laurent': '#B8B1DF',
  'Régional':          '#A8DCF4'
};`,
    'couleurs des épingles');

  html = uneFois(html,
    "const REGION_LABELS = { 'Est': 'Montérégie-Est' };",
    "const REGION_LABELS = { 'Est': 'Montérégie-Est', 'Centre': 'Montérégie-Centre', 'Ouest': 'Montérégie-Ouest' };",
    'libellés de région');

  html = uneFois(html,
    "let rlsFilter = '';",
    "let rlsFilter = '';\nlet regionFilter = new Set();",
    'filtre de région');

  html = uneFois(html,
    `    rls: inst.missionRegionale ? 'Régional' : (inst.territoireSource || ''),
    ville: inst.ville || '',`,
    `    rls: inst.missionRegionale ? 'Régional' : (inst.territoireSource || ''),
    region: inst.missionRegionale ? 'Est' : (RLS_VERS_REGION[inst.territoireSource] || ''),
    ville: inst.ville || '',`,
    'région des installations');

  html = uneFois(html,
    `      rls: inst.rls,
      ville: inst.ville,`,
    `      rls: inst.rls,
      region: inst.region,
      ville: inst.ville,`,
    'région des secteurs');

  html = uneFois(html,
    `  if (rlsFilter) {
    const g = byId(id);
    if (!g) return false;
    if (modeCarte === 'etablissements' && g._secteurEtab) {`,
    `  if (regionFilter.size) {
    const g = byId(id);
    if (!regionFilter.has(g && g.region)) return false;
  }
  if (rlsFilter) {
    const g = byId(id);
    if (!g) return false;
    if (modeCarte === 'etablissements' && g._secteurEtab) {`,
    'filtre région des milieux');

  html = uneFois(html,
    `  if (rlsFilter && (h.rls || '') !== rlsFilter) return false;
  return true;
}`,
    `  if (regionFilter.size && !regionFilter.has(h.region)) return false;
  if (rlsFilter && (h.rls || '') !== rlsFilter) return false;
  return true;
}`,
    'filtre région des hôpitaux');

  html = uneFois(html,
    `    const doitEtreVisible = rlsFilter === TERRITOIRE_MISSIONS
      ? false
      : (!rlsFilter || rlsFilter === nomRls);`,
    `    const regionOk = !regionFilter.size || regionFilter.has(RLS_VERS_REGION[nomRls]);
    const doitEtreVisible = rlsFilter === TERRITOIRE_MISSIONS
      ? false
      : regionOk && (!rlsFilter || rlsFilter === nomRls);`,
    'zones selon la région');

  html = uneFois(html,
    `function couleurMilieu(g) {
  return (g && RLS_COLORS_REGION[g.rls]) || '#08A0A0';
}`,
    `function couleurMilieu(g) {
  if (g && COULEURS_TERRITOIRE[g.region]) return COULEURS_TERRITOIRE[g.region];
  return (g && RLS_COLORS_REGION[g.rls]) || '#0080D7';
}`,
    'couleur par région');

  html = uneFois(html,
    `  return RLS_COLORS_PALES_REGION[g.rls] || couleurMilieu(g);
}`,
    `  if (g && COULEURS_TERRITOIRE_PALES[g.region]) return COULEURS_TERRITOIRE_PALES[g.region];
  return RLS_COLORS_PALES_REGION[g.rls] || couleurMilieu(g);
}`,
    'couleur pâle par région');

  html = uneFois(html,
    `    d.innerHTML = '<div class="rls-legend-title">Réseau local (RLS)</div>' +
      Object.keys(RLS_COLORS_REGION).filter(r => r !== 'Régional')
        .map(r => ligne(RLS_COLORS_REGION[r], r)).join('');`,
    `    d.innerHTML = '<div class="rls-legend-title">Région</div>' +
      ligne('#0080D7', 'Montérégie-Est') +
      ligne('#08A0A0', 'Montérégie-Centre') +
      ligne('#170A72', 'Montérégie-Ouest');`,
    'légende initiale');

  html = uneFois(html,
    `  let html = \`<div class="rls-legend-title">\${etab ? 'Territoire' : 'Réseau local (RLS)'}</div>\` +
    Object.keys(RLS_COLORS_REGION).filter(r => r !== 'Régional')
      .map(r => ligne(RLS_COLORS_REGION[r], r)).join('');
  if (etab && hasMissionsRegionales()) html += ligne(RLS_COLORS_REGION['Régional'], TERRITOIRE_MISSIONS);
  legendEl.innerHTML = html;`,
    `  let html = '<div class="rls-legend-title">Région</div>' +
    ligne('#0080D7', 'Montérégie-Est') +
    ligne('#08A0A0', 'Montérégie-Centre') +
    ligne('#170A72', 'Montérégie-Ouest');
  legendEl.innerHTML = html;`,
    'légende des trois régions');

  html = uneFois(html,
    '          <div class="rls-btns" id="rls-btns" role="group" aria-label="Filtrer par RLS"></div>',
    `          <div class="reg-filter" id="reg-filter" role="group" aria-label="Filtrer par région"></div>
          <select class="rls-filter" id="rls-filter" aria-label="Filtrer par RLS"></select>`,
    'boutons de région et menu des RLS');

  html = uneFois(html,
    `      <div class="vw-row"><span class="vw-label">Région</span><span class="vw-value"><span class="rls-dot" style="background:#170A72"></span>\${REGION_LABELS[g.region] || 'À venir'}</span></div>`,
    `      <div class="vw-row"><span class="vw-label">Région</span><span class="vw-value"><span class="rls-dot" style="background:\${couleurMilieu(g)}"></span>\${REGION_LABELS[g.region] || 'À venir'}</span></div>`,
    'pastille de région');

  html = uneFois(html,
    '  if (shown === 0 && (favOnly || rlsFilter || activiteFilters.size || searchQuery)) {',
    '  if (shown === 0 && (favOnly || regionFilter.size || rlsFilter || activiteFilters.size || searchQuery)) {',
    'liste vide');

  html = uneFois(html,
    `function rlsForRegions() {
  const set = new Set();
  gmfs.forEach(g => {
    if (modeCarte === 'etablissements' && g._secteurEtab) {
      if (g.missionRegionale) return;
      if (g.rls && String(g.rls).trim()) set.add(String(g.rls).trim());
    } else if (g.rls && String(g.rls).trim()) {
      set.add(String(g.rls).trim());
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}`,
    `function rlsForRegions() {
  const set = new Set();
  gmfs.forEach(g => {
    if (regionFilter.size && !regionFilter.has(g.region)) return;
    if (modeCarte === 'etablissements' && g._secteurEtab) {
      if (g.missionRegionale) return;
      if (g.rls && String(g.rls).trim()) set.add(String(g.rls).trim());
    } else if (g.rls && String(g.rls).trim()) {
      set.add(String(g.rls).trim());
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}
function populateRlsSelect() {
  const sel = document.getElementById('rls-filter');
  if (!sel) return;
  const opts = rlsForRegions();
  const prev = rlsFilter;
  let choix = '<option value="">Tous les RLS</option>' +
    opts.map(r => '<option value="' + esc(r) + '">' + esc(r) + '</option>').join('');
  const missions = modeCarte === 'etablissements' && gmfs.some(g => g._secteurEtab && g.missionRegionale && (!regionFilter.size || regionFilter.has(g.region)));
  if (missions) choix += '<option value="' + esc(TERRITOIRE_MISSIONS) + '">' + esc(TERRITOIRE_MISSIONS) + '</option>';
  sel.innerHTML = choix;
  const permis = prev && (opts.indexOf(prev) !== -1 || (missions && prev === TERRITOIRE_MISSIONS));
  if (permis) sel.value = prev;
  else { rlsFilter = ''; sel.value = ''; }
}
function syncRegChips() {
  const toutes = regionFilter.size === 0;
  document.querySelectorAll('#reg-filter .reg-chip').forEach(b => {
    const on = toutes || regionFilter.has(b.dataset.reg);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}`,
    'menu déroulant des RLS');

  html = uneFois(html,
    `function buildFilters() {
  populateActiviteButtons();
  const btnWrap = document.getElementById('rls-btns');
  if (btnWrap) populateRlsButtons();
  syncPanneauTerritoire();
}`,
    `function buildFilters() {
  if (!buildFilters.lu) {
    buildFilters.lu = true;
    const reg = new URLSearchParams(location.search).get('region');
    if (reg && COULEURS_TERRITOIRE[reg]) regionFilter.add(reg);
  }
  populateActiviteButtons();
  const wrap = document.getElementById('reg-filter');
  if (wrap) {
    wrap.innerHTML = '';
    ['Est', 'Centre', 'Ouest'].forEach(key => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'reg-chip';
      b.textContent = key;
      b.dataset.reg = key;
      b.title = REGION_LABELS[key];
      b.style.setProperty('--c', COULEURS_TERRITOIRE[key]);
      b.setAttribute('aria-label', 'Filtrer : ' + REGION_LABELS[key]);
      b.addEventListener('click', () => {
        if (regionFilter.has(key)) regionFilter.delete(key); else regionFilter.add(key);
        syncRegChips();
        try { history.replaceState(history.state, '', urlEtat(activeId)); } catch (e) {}
        populateRlsSelect();
        synchroniserOverlaysRlsEstOfficielle();
        if (modeCarte === 'etablissements') populateActiviteButtons();
        renderSidebar(); updateMarkerVisibility(); fitToVisible();
      });
      wrap.appendChild(b);
    });
    syncRegChips();
  }
  const sel = document.getElementById('rls-filter');
  if (sel && !sel.dataset.branche) {
    sel.dataset.branche = '1';
    sel.addEventListener('change', () => {
      rlsFilter = sel.value;
      synchroniserOverlaysRlsEstOfficielle();
      if (modeCarte === 'etablissements') populateActiviteButtons();
      renderSidebar(); updateMarkerVisibility(); fitToVisible();
    });
  }
  populateRlsSelect();
  syncPanneauTerritoire();
}`,
    'filtres de la carte générale');

  // Lecture des établissements comme la carte Montérégie : le Centre range le
  // responsable, le besoin et les précisions sous « recrutement ».
  html = uneFois(html,
    "    adresse: inst.adresse || '',\n    missionRegionale: !!inst.missionRegionale,",
    "    adresse: inst.adresse || '',\n    telephone: inst.telephone || '',\n    missionRegionale: !!inst.missionRegionale,",
    'téléphone lu');
  html = uneFois(html,
    "    referenceExistante: inst.referenceExistante || null,\n    _installationEtab: true",
    "    referenceExistante: inst.referenceExistante || null,\n    coordonneesApproximatives: !!inst.coordonneesApproximatives,\n    _installationEtab: true",
    'emplacement approximatif lu');
  html = uneFois(html,
    "      responsableNom: sec.responsableNom || '',\n      responsableCourriel: sec.responsableCourriel || '',\n      _secteurEtab: true",
    "      responsableNom: sec.responsableNom || (sec.recrutement || {}).responsableNom || '',\n      responsableCourriel: sec.responsableCourriel || (sec.recrutement || {}).responsableCourriel || '',\n      besoinDeclare: (sec.recrutement || {}).besoinDeclare || '',\n      notesPubliques: Array.isArray((sec.recrutement || {}).notesPubliques) ? sec.recrutement.notesPubliques.slice() : [],\n      dme: sec.dme || (sec.recrutement || {}).dme || '',\n      _secteurEtab: true",
    'secteur lu');

  html = uneFois(html,
    "  if (g.missionRegionale) return 'Mission régionale';\n  return g.rls ? ('RLS ' + g.rls) : 'À venir';\n}",
    "  const lieu = g.missionRegionale ? 'Mission régionale' : (g.rls ? ('RLS ' + g.rls) : '');\n  const nom = g.region ? (REGION_LABELS[g.region] || g.region) : '';\n  if (nom) return lieu ? (nom + ' · ' + lieu) : nom;\n  return lieu || 'À venir';\n}",
    'région devant le RLS');
  html = uneFois(html,
    '<div class="vw-sec-title">Secteurs en recrutement (${visibles.length})</div>',
    '<div class="vw-sec-title">Secteurs (${visibles.length})</div>',
    'titre des secteurs');

  // Filtre de territoire (?region=) : gardé dans l'adresse et suivi par le cadrage
  // (audit du 3 oct. 2026). Le gabarit Est n'est pas modifié.
  html = uneFois(html,
    "  showBanner();\n  fitToData();\n  if (appliquerCibleUrl(paramsInit)) return;",
    "  showBanner();\n  if (regionFilter.size) fitToVisible(); else fitToData();\n  if (appliquerCibleUrl(paramsInit)) return;",
    'cadrage initial du territoire');
  html = uneFois(html,
    "  synchroniserOverlaysRlsEstOfficielle();\n  fitToData();\n  try { history.replaceState({}, '', urlEtat()); } catch (e) {}",
    "  synchroniserOverlaysRlsEstOfficielle();\n  if (regionFilter.size) fitToVisible(); else fitToData();\n  try { history.replaceState({}, '', urlEtat()); } catch (e) {}",
    'cadrage au changement de mode');
  html = uneFois(html,
    "    params.set('c', String(id));\n  }\n  const q = params.toString();",
    "    params.set('c', String(id));\n  }\n  if (regionFilter.size === 1) params.set('region', Array.from(regionFilter)[0]);\n  const q = params.toString();",
    'territoire dans l’adresse');

  // Mêmes renseignements que la carte Montérégie (scripts/carte.template.html) :
  // tout vient de data.json et des fichiers d'établissements, rien d'autre.
  html = uneFois(html,
    "      <div class=\"vw-row\"><span class=\"vw-label\">Adresse</span><span class=\"vw-value\">${mapsLink(inst)}</span></div>\n      ${inst.lienWeb ?",
    "      <div class=\"vw-row\"><span class=\"vw-label\">Adresse</span><span class=\"vw-value\">${mapsLink(inst)}</span></div>\n      ${inst.telephone ? `<div class=\"vw-row\"><span class=\"vw-label\">Téléphone</span><span class=\"vw-value\"><a href=\"tel:${esc(String(inst.telephone).replace(/[^\\d+]/g, ''))}\">${esc(inst.telephone)}</a></span></div>` : ''}\n      ${inst.lienWeb ?",
    'téléphone de l’établissement');
  html = uneFois(html,
    "      ${inst.mentionPublique ? `<div class=\"vw-row\"><span class=\"vw-label\">Note</span><span class=\"vw-value\">${esc(inst.mentionPublique)}</span></div>` : ''}\n",
    "      ${inst.mentionPublique ? `<div class=\"vw-row\"><span class=\"vw-label\">Note</span><span class=\"vw-value\">${esc(inst.mentionPublique)}</span></div>` : ''}\n      ${inst.coordonneesApproximatives ? `<div class=\"vw-row\"><span class=\"vw-label\">Carte</span><span class=\"vw-value\">Emplacement approximatif (adresse officielle, pin à confirmer).</span></div>` : ''}\n",
    'emplacement approximatif');
  html = uneFois(html,
    "function htmlCorpsSecteur(s) {\n  return `<div class=\"dp-sect-corps\">\n",
    "function htmlCorpsSecteur(s) {\n  const notes = (s.notesPubliques || []).map(n => `<div class=\"vw-row\"><span class=\"vw-label\">Précision</span><span class=\"vw-value\">${esc(n)}</span></div>`).join('');\n  return `<div class=\"dp-sect-corps\">\n      ${s.besoinDeclare ? `<div class=\"vw-row\"><span class=\"vw-label\">Besoin déclaré</span><span class=\"vw-value\">${esc(s.besoinDeclare)}</span></div>` : ''}\n      ${s.dme ? `<div class=\"vw-row\"><span class=\"vw-label\">Dossier médical</span><span class=\"vw-value\">${esc(s.dme)}</span></div>` : ''}\n",
    'besoin et dossier médical du secteur');
  html = uneFois(html,
    "<a href=\"/monteregie-est/ptem-u/\">Guide PTEM-U</a></span></div>` : ''}\n      <div class=\"vw-row\"><span class=\"vw-label\">Contact</span>",
    "<a href=\"/monteregie-est/ptem-u/\">Guide PTEM-U</a></span></div>` : ''}\n      ${notes}\n      <div class=\"vw-row\"><span class=\"vw-label\">Contact</span>",
    'précisions du secteur');

  html = uneFois(html,
    "const NOTE_KEY  = id => 'dtmf-mtg-note-' + id;\nconst ORDER_KEY = 'dtmf-mtg-ordre';\nconst FAVORDER_KEY = 'dtmf-mtg-ordre-favoris';\nconst FAVORDER_ETAB_KEY = 'dtmf-mtg-ordre-favoris-etablissements';\nconst FAV_KEY   = 'dtmf-mtg-favoris';\nconst FAV_SECTEURS_KEY = 'ttc-est-secteurs-favoris-v1';\nconst NOTE_SECTEUR_KEY = id => 'ttc-est-secteur-note-v1-' + id;",
    "const NOTE_KEY  = id => 'ttc-sq-mtg-note-' + id;\nconst ORDER_KEY = 'ttc-sq-mtg-ordre';\nconst FAVORDER_KEY = 'ttc-sq-mtg-ordre-favoris';\nconst FAVORDER_ETAB_KEY = 'ttc-sq-mtg-ordre-favoris-etablissements';\nconst FAV_KEY   = 'ttc-sq-mtg-favoris';\nconst FAV_SECTEURS_KEY = 'ttc-sq-mtg-secteurs-favoris';\nconst NOTE_SECTEUR_KEY = id => 'ttc-sq-mtg-secteur-note-' + id;",
    'clés locales');

  html = uneFois(html, "const ANNONCE_KEY = 'dtmf-mtg-annonce-fermee';", "const ANNONCE_KEY = 'ttc-sq-mtg-annonce-fermee';", 'annonce');

  html = uneFois(html,
    '      <div class="cmp-subtitle">Trouve ta clinique · Recrutement médical · Montérégie-Est</div>',
    '      <div class="cmp-subtitle">Trouve ta clinique · Recrutement médical · Montérégie</div>',
    'comparatif');
  html = uneFois(html,
    "Trouve ta clinique · ${etab ? 'Établissements' : 'Cliniques'} en recrutement · Montérégie-Est",
    "Trouve ta clinique · ${etab ? 'Établissements' : 'Cliniques'} en recrutement · Montérégie",
    'note du comparatif');

  html = uneFois(html, "  cliniques = cliniques.filter(g => g.region === 'Est');\n", '', 'filtre Est des cliniques');
  html = uneFois(html, "    if (h.region !== 'Est') return false;\n", '', 'filtre Est des hôpitaux');

  html = uneFois(html,
    `fetch('../data.json', { cache: 'no-cache' })
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(data => Promise.all([
    data,
    fetch('../data-etablissements.json', { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
  ]))
  .then(([data, etabData]) => initData(data, etabData))`,
    `function fusionnerEtablissements(estData, centreData) {
  const lots = [estData, centreData].filter(Boolean);
  const installations = [];
  const secteurs = [];
  const categories = [];
  const vus = new Set();
  lots.forEach(lot => {
    (lot.installations || []).forEach(inst => installations.push(inst));
    (lot.secteurs || []).forEach(sec => secteurs.push(sec));
    (((lot.meta || {}).categoriesActivite) || []).forEach(cat => {
      if (cat && cat.id && !vus.has(cat.id)) { vus.add(cat.id); categories.push(cat); }
    });
  });
  return { installations: installations, secteurs: secteurs, meta: { categoriesActivite: categories } };
}
function chargerJsonCarte(url) {
  return fetch(url, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
}
fetch('../data.json', { cache: 'no-cache' })
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(data => Promise.all([
    data,
    chargerJsonCarte('../data-etablissements.json'),
    chargerJsonCarte('../data-etablissements-centre.json')
  ]))
  .then(([data, etabEst, etabCentre]) => initData(data, fusionnerEtablissements(etabEst, etabCentre)))`,
    'chargement des trois territoires');

  html = uneFois(html, "  var regNom = 'Montérégie-Est';", "  var regNom = 'Montérégie';", 'partage');
  html = uneFois(html, "  var TITRE = 'Trouve ta clinique · Montérégie-Est';", "  var TITRE = 'Trouve ta clinique · Montérégie';", 'titre de partage');
  html = uneFois(html,
    '<div class="cmp-qrurl">trouvetaclinique.ca/monteregie-est/</div>',
    '<div class="cmp-qrurl">trouvetaclinique.ca/monteregie/</div>',
    'adresse imprimée');

  html = html.replace('<!-- PWA_SERVICE_WORKER -->', '');

  if (html.includes("g.region === 'Est'") || html.includes("h.region !== 'Est'")) {
    throw new Error('Un filtre qui limite la carte à l’Est est resté dans la page.');
  }
  if (!html.includes('data-etablissements-centre.json')) throw new Error('Les établissements du Centre ne sont pas chargés.');
  if (html.includes('fiches-publiques.json') || html.includes('Renseignements publics')) {
    throw new Error('La carte doit afficher seulement les données de data.json et des établissements.');
  }
  if (html.includes('noindex')) throw new Error('La carte de la Montérégie doit être indexable.');
  if (/kaushan/i.test(html)) throw new Error('Kaushan Script ne doit pas apparaître.');
  if (!html.includes('Segoe UI')) throw new Error('Segoe UI est absente.');
  if (!html.includes('max-width: 860px')) throw new Error('Le seuil cellulaire de 860 px est absent.');

  return html;
}

function ecrire() {
  fs.mkdirSync(path.dirname(SORTIE_RENVOI), { recursive: true });
  fs.writeFileSync(SORTIE_RENVOI, pageRenvoi(), 'utf8');
  console.log('carte-interactive/index.html écrit (renvoi vers /monteregie/).');
}

module.exports = { generer, pageRenvoi, ecrire };

if (require.main === module) ecrire();
