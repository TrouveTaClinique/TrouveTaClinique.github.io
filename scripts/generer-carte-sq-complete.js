#!/usr/bin/env node
/*
 * Carte non répertoriée de toute la Montérégie, dans le thème Santé Québec.
 * Lit le gabarit Est (sans le modifier) et écrit carte-sante-quebec/index.html.
 * Les quatre cartes publiées ne passent pas par ce script.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const GABARIT = path.join(__dirname, 'carte-est-sq.template.html');
const SORTIE = path.join(RACINE, 'carte-sante-quebec', 'index.html');

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
<title>Carte Santé Québec de la Montérégie</title>
<meta name="description" content="Carte non répertoriée des cliniques et des établissements de la Montérégie, dans le thème Santé Québec. Adresse directe seulement.">
<meta name="robots" content="noindex, nofollow">
<link rel="canonical" href="https://trouvetaclinique.ca/carte-sante-quebec/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Trouve ta clinique">
<meta property="og:locale" content="fr_CA">
<meta property="og:url" content="https://trouvetaclinique.ca/carte-sante-quebec/">
<meta property="og:title" content="Carte Santé Québec de la Montérégie">
<meta property="og:description" content="Carte non répertoriée des cliniques et des établissements de la Montérégie.">
<meta name="theme-color" content="#170A72">
<link rel="icon" type="image/png" sizes="32x32" href="../favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="../favicon-16.png">
<link rel="stylesheet" href="../leaflet.css">
<link rel="stylesheet" href="../vendor/maplibre-gl.css">
<link rel="preconnect" href="https://basemaps.cartocdn.com" crossorigin>
<link rel="preconnect" href="https://tiles.basemaps.cartocdn.com" crossorigin>
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
    '.fiche-public a { word-break: break-word; }\n</style>',
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
    `      <a class="info-menu-link" role="menuitem" href="https://www.santemonteregie.qc.ca/est/recrutement-medical-monteregie-est" target="_blank" rel="noopener">
        <span class="info-menu-ic">i</span> Recrutement, Montérégie-Est
      </a>
      <hr>
      <a class="info-menu-link" role="menuitem" href="/monteregie-est/ptem/">
        <span class="info-menu-ic">📘</span> Guide PTEM, Montérégie-Est
      </a>
      <a class="info-menu-link" role="menuitem" href="/monteregie-centre/ptem/">
        <span class="info-menu-ic">📘</span> Guide PTEM, Montérégie-Centre
      </a>
      <a class="info-menu-link" role="menuitem" href="/monteregie-ouest/ptem/">
        <span class="info-menu-ic">📘</span> Guide PTEM, Montérégie-Ouest
      </a>
      <a class="info-menu-link" role="menuitem" href="/monteregie-est/amp/">
        <span class="info-menu-ic">📗</span> Guide des AMP, Montérégie-Est
      </a>
      <a class="info-menu-link" role="menuitem" href="/monteregie-centre/amp/">
        <span class="info-menu-ic">📗</span> Guide des AMP, Montérégie-Centre
      </a>
      <a class="info-menu-link" role="menuitem" href="/monteregie-ouest/amp/">
        <span class="info-menu-ic">📗</span> Guide des AMP, Montérégie-Ouest
      </a>`,
    'menu');

  html = uneFois(html,
    '<h1 class="sr-only" id="page-h1">Trouve ta clinique · Cliniques en recrutement en Montérégie-Est</h1>\n<p class="sr-only" id="page-desc">\n  Carte interactive des cliniques et points de service qui recrutent des médecins de famille\n  en Montérégie-Est, dans les réseaux locaux de services Pierre-Boucher, Richelieu-Yamaska et Pierre-De Saurel. Pour chaque milieu :\n  coordonnées, type de clinique, réseau local de services, pratiques offertes, horaires et\n  personne-ressource pour le recrutement.\n</p>',
    '<h1 class="sr-only" id="page-h1">Trouve ta clinique · Cliniques en recrutement en Montérégie</h1>\n<p class="sr-only" id="page-desc">\n  Carte non répertoriée des cliniques et des établissements de la Montérégie\n  (Est, Centre et Ouest), dans le thème Santé Québec.\n</p>',
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
    "if (desc) desc.textContent = 'Carte non répertoriée des secteurs en établissement de la Montérégie (Est, Centre et Ouest).';",
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
    "if (desc) desc.textContent = 'Carte non répertoriée des cliniques de la Montérégie (Est, Centre et Ouest), dans le thème Santé Québec.';",
    'description cliniques');

  html = uneFois(html,
    `const COULEURS_RLS_EST_SQ = {
  'Pierre-Boucher': '#0080D7',
  'Richelieu-Yamaska': '#08A0A0',
  'Pierre-De Saurel': '#170A72'
};`,
    `const COULEURS_RLS_EST_SQ = {
  'Pierre-Boucher': '#0080D7',
  'Richelieu-Yamaska': '#08A0A0',
  'Pierre-De Saurel': '#170A72',
  'Champlain': '#0A6B5C',
  '${HRR}': '#9A4A16',
  'Jardins-Roussillon': '#1A4578',
  'Vaudreuil-Soulanges': '#4C3D78',
  '${SUROIT}': '#8A3050',
  'du Haut-Saint-Laurent': '#2F5A3C'
};`,
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
  'Richelieu-Yamaska': '#08A0A0',
  'Pierre-De Saurel':  '#170A72',
  'Champlain':         '#0A6B5C',
  '${HRR}': '#9A4A16',
  'Jardins-Roussillon': '#1A4578',
  'Vaudreuil-Soulanges': '#4C3D78',
  '${SUROIT}': '#8A3050',
  'du Haut-Saint-Laurent': '#2F5A3C',
  'Régional':          '#6D28D9'
};
const RLS_COLORS_PALES_REGION = {
  'Pierre-Boucher':    '#A8DCF4',
  'Richelieu-Yamaska': '#A7DFDC',
  'Pierre-De Saurel':  '#B8B1DF',
  'Champlain':         '#B7E0D6',
  '${HRR}': '#F0CDB8',
  'Jardins-Roussillon': '#C5D4EA',
  'Vaudreuil-Soulanges': '#D4CCE8',
  '${SUROIT}': '#F0C9D6',
  'du Haut-Saint-Laurent': '#C9E0CF',
  'Régional':          '#C4B5FD'
};`,
    'couleurs des épingles');

  html = uneFois(html,
    "const REGION_LABELS = { 'Est': 'Montérégie-Est' };",
    "const REGION_LABELS = { 'Est': 'Montérégie-Est', 'Centre': 'Montérégie-Centre', 'Ouest': 'Montérégie-Ouest' };",
    'libellés de région');

  const aidePublique = `
let fichesPubliques = { cliniques: {}, etablissements: {}, hopitaux: {} };
function hotePublic(u) {
  try { return new URL(u).hostname.replace(/^www\\./, ''); } catch (e) { return 'source'; }
}
function htmlRenseignementsPublics(kind, id) {
  const sac = fichesPubliques && fichesPubliques[kind];
  const f = sac && sac[String(id)];
  if (!f) return '';
  const ligne = (lbl, val) => '<div class="vw-row"><span class="vw-label">' + lbl + '</span><span class="vw-value">' + val + '</span></div>';
  const bits = [];
  if (f.telephone) {
    const digits = String(f.telephone).replace(/[^\\d+]/g, '');
    bits.push(ligne('Téléphone vérifié', '<a href="tel:' + esc(digits) + '">' + esc(f.telephone) + '</a>'));
  }
  if (f.adresse) bits.push(ligne('Adresse vérifiée', esc(f.adresse)));
  if (f.site) bits.push(ligne('Site vérifié', siteLink(f.site)));
  if (f.niveauGmf) bits.push(ligne('Niveau GMF', esc(String(f.niveauGmf))));
  if (f.services && f.services.length) bits.push(ligne('Services', esc(f.services.join(', '))));
  if (f.recrutement) bits.push(ligne('Recrutement', esc(f.recrutement)));
  if (!bits.length) return '';
  const sources = (f.sources || []).filter(Boolean)
    .map(u => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(hotePublic(u)) + '</a>')
    .join(', ');
  return '<div class="vw-sec fiche-public"><div class="vw-sec-title">Renseignements publics</div>'
    + bits.join('') + (sources ? ligne('Source', sources) : '')
    + '</div><div class="vw-divider"></div>';
}
`;
  html = uneFois(html, 'function hopitalPopupHtml(h) {', aidePublique + 'function hopitalPopupHtml(h) {', 'aide publique');
  html = uneFois(html,
    "${urlWebSure(h.site) ? `<p><a href=\"${esc(urlWebSure(h.site))}\" target=\"_blank\" rel=\"noopener\">Suivre le projet ↗</a></p>` : ''}\n    </div>`;",
    "${urlWebSure(h.site) ? `<p><a href=\"${esc(urlWebSure(h.site))}\" target=\"_blank\" rel=\"noopener\">Suivre le projet ↗</a></p>` : ''}\n      ${htmlRenseignementsPublics('hopitaux', h.id)}\n    </div>`;",
    'popup chantier');
  html = uneFois(html,
    "${urlWebSure(h.site) ? `<p><a href=\"${esc(urlWebSure(h.site))}\" target=\"_blank\" rel=\"noopener\">Fiche de l'établissement ↗</a></p>` : ''}\n  </div>`;",
    "${urlWebSure(h.site) ? `<p><a href=\"${esc(urlWebSure(h.site))}\" target=\"_blank\" rel=\"noopener\">Fiche de l'établissement ↗</a></p>` : ''}\n    ${htmlRenseignementsPublics('hopitaux', h.id)}\n  </div>`;",
    'popup hôpital');
  html = uneFois(html,
    "${inst.lienWeb ? `<div class=\"vw-row\"><span class=\"vw-label\">Site internet</span><span class=\"vw-value\">${siteLink(inst.lienWeb)}</span></div>` : ''}",
    "${inst.lienWeb ? `<div class=\"vw-row\"><span class=\"vw-label\">Site internet</span><span class=\"vw-value\">${siteLink(inst.lienWeb)}</span></div>` : ''}\n      ${htmlRenseignementsPublics('etablissements', inst.id)}",
    'fiche établissement');
  html = uneFois(html,
    '<div class="vw-row"><span class="vw-label">Adresse</span><span class="vw-value">${mapsLink(g)}</span></div>',
    '<div class="vw-row"><span class="vw-label">Adresse</span><span class="vw-value">${mapsLink(g)}</span></div>\n      ${htmlRenseignementsPublics(\'cliniques\', g.id)}',
    'fiche clinique');

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
    chargerJsonCarte('../data-etablissements-centre.json'),
    chargerJsonCarte('fiches-publiques.json')
  ]))
  .then(([data, etabEst, etabCentre, fiches]) => {
    fichesPubliques = fiches || { cliniques: {}, etablissements: {}, hopitaux: {} };
    return initData(data, fusionnerEtablissements(etabEst, etabCentre));
  })`,
    'chargement des trois territoires');

  html = uneFois(html, "  var regNom = 'Montérégie-Est';", "  var regNom = 'Montérégie';", 'partage');
  html = uneFois(html, "  var TITRE = 'Trouve ta clinique · Montérégie-Est';", "  var TITRE = 'Trouve ta clinique · Montérégie';", 'titre de partage');
  html = uneFois(html,
    '<div class="cmp-qrurl">trouvetaclinique.ca/monteregie-est/</div>',
    '<div class="cmp-qrurl">trouvetaclinique.ca/carte-sante-quebec/</div>',
    'adresse imprimée');

  html = html.replace('<!-- PWA_SERVICE_WORKER -->', '');

  if (html.includes("g.region === 'Est'") || html.includes("h.region !== 'Est'")) {
    throw new Error('Un filtre qui limite la carte à l’Est est resté dans la page.');
  }
  if (!html.includes('data-etablissements-centre.json')) throw new Error('Les établissements du Centre ne sont pas chargés.');
  if (!html.includes('fiches-publiques.json')) throw new Error('Le fichier de renseignements publics n’est pas chargé.');
  if (!html.includes('noindex, nofollow')) throw new Error('La page doit rester noindex.');
  if (/kaushan/i.test(html)) throw new Error('Kaushan Script ne doit pas apparaître.');
  if (!html.includes('Segoe UI')) throw new Error('Segoe UI est absente.');
  if (!html.includes('max-width: 860px')) throw new Error('Le seuil cellulaire de 860 px est absent.');

  return html;
}

function ecrire() {
  const html = generer();
  fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
  fs.writeFileSync(SORTIE, html, 'utf8');
  console.log('carte-sante-quebec/index.html écrit (' + html.length + ' caractères).');
}

module.exports = { generer, ecrire };

if (require.main === module) ecrire();
