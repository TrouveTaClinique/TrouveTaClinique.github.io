#!/usr/bin/env node
/*
 * Fabrique les quatre cartes à partir d'un seul gabarit :
 *   scripts/carte.template.html  →  monteregie/index.html
 *                                →  monteregie-est/index.html
 *                                →  monteregie-centre/index.html
 *                                →  monteregie-ouest/index.html
 *
 * La racine / est réservée à la page d'accueil générée par generer-pages-seo.js. Le gabarit
 * n'est jamais servi directement. Les quatre sorties gardent exactement la même application,
 * les mêmes données. L'Est reprend désormais le gabarit SQ historique carte-est-sq.template.html
 * pour conserver le prototype validé; les autres cartes gardent le gabarit partagé.
 * La PWA et le service worker appartiennent uniquement à Montérégie-Est.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SOURCE = path.join(__dirname, 'carte.template.html');
const SOURCE_EST_SQ = path.join(__dirname, 'carte-est-sq.template.html');
const SORTIE_GENERALE = path.join(RACINE, 'monteregie', 'index.html');

const TERRITOIRES = [
  {
    dossier: 'monteregie-est', nom: 'Montérégie-Est', mot: 'Est', region: 'Est',
    accent: '#e6007e', app: true,
    recrutement: 'https://www.santemonteregie.qc.ca/est/recrutement-medical-monteregie-est',
    rls: [
      ['Pierre-Boucher', '#ee2d62', 'pierre-boucher'],
      ['Richelieu-Yamaska', '#15803d', 'richelieu-yamaska'],
      ['Pierre-De Saurel', '#2f4a7a', 'pierre-de-saurel']
    ],
    banniere: {
      url: 'https://trouvetaclinique.ca/assets/og-est.png',
      largeur: '1200', hauteur: '630',
      alt: 'Trouve ta clinique · carte des milieux en recrutement en Montérégie-Est.'
    }
  },
  {
    dossier: 'monteregie-centre', nom: 'Montérégie-Centre', mot: 'centre', region: 'Centre',
    couleur: '#5fd968', halo: 'rgba(67,160,71,.85)',
    accent: '#43a047', app: false, recrutement: null,
    rls: [
      ['Champlain', '#0080d7', 'champlain'],
      ['Haut-Richelieu–Rouville', '#43a047', 'haut-richelieu-rouville']
    ],
    banniere: null
  },
  {
    dossier: 'monteregie-ouest', nom: 'Montérégie-Ouest', mot: 'ouest', region: 'Ouest',
    couleur: '#3db4ff', halo: 'rgba(0,128,215,.85)',
    accent: '#0080d7', app: false, recrutement: null,
    rls: [
      ['Jardins-Roussillon', '#0080d7', 'jardins-roussillon'],
      ['Vaudreuil-Soulanges', '#43a047', 'vaudreuil-soulanges'],
      ['du Suroît', '#ee2d62', 'du-suroit'],
      ['du Haut-Saint-Laurent', '#7c3aed', 'du-haut-saint-laurent']
    ],
    banniere: null
  }
];

const BLOC_HORS_REGION = /[ \t]*<!-- hors-region:debut[\s\S]*?hors-region:fin -->[ \t]*\r?\n?/g;

function phraseRls(t) {
  const noms = t.rls.map(([nom]) => nom);
  const dernier = noms.pop();
  return noms.length ? noms.join(', ') + ' et ' + dernier : dernier;
}

function menuRls(t) {
  return t.rls.map(([nom, couleur, slug]) =>
    `      <a class="info-menu-link" role="menuitem" href="rls/${slug}/">\n` +
    `        <span class="info-menu-ic" style="background:${couleur}">📋</span> Cliniques : RLS ${nom}\n` +
    '      </a>'
  ).join('\n');
}

function remplacer(etat, ancien, nouveau, libelle) {
  if (!etat.html.includes(ancien)) {
    etat.manques.push(libelle || ancien.slice(0, 80));
    return;
  }
  etat.html = etat.html.replace(ancien, nouveau);
}

function pwaHead() {
  return `<link rel="manifest" href="../manifest-est.webmanifest">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="PTEM 2027">
<link rel="apple-touch-icon" href="../apple-touch-icon-est.png">`;
}

function pwaServiceWorker() {
  return `<script>
// Enregistrement strictement limité à la portée /monteregie-est/.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    let controleurConnu = navigator.serviceWorker.controller;
    let rechargementDeMiseAJour = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!controleurConnu) { controleurConnu = navigator.serviceWorker.controller; return; }
      if (rechargementDeMiseAJour) return;
      rechargementDeMiseAJour = true;
      window.location.reload();
    });
    navigator.serviceWorker.register('../sw.js', {
      scope: '/monteregie-est/', updateViaCache: 'none'
    }).then(registration => {
      const verifierMiseAJour = () => registration.update().catch(() => {});
      verifierMiseAJour();
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) verifierMiseAJour();
      });
    }).catch(() => {});
    console.log('Trouve ta clinique — Montérégie-Est — build 2026-08-31');
  });
}
</script>`;
}

function appliquerIdentiteRegionale(source, t) {
  const etat = { html: source.replace(/\r\n/g, '\n').replace(BLOC_HORS_REGION, ''), manques: [] };
  const r = (ancien, nouveau, libelle) => remplacer(etat, ancien, nouveau, libelle);

  r('<title>Carte complète de la Montérégie : Cliniques en recrutement</title>',
    `<title>Cliniques en recrutement : ${t.nom}</title>`, 'titre');
  r('<meta name="description" content="Carte interactive des cliniques et établissements en recrutement en Montérégie, pour préparer votre PTEM 2027.">',
    `<meta name="description" content="Carte interactive des cliniques et établissements en recrutement en ${t.nom}, pour préparer votre PTEM 2027.">`, 'description');
  r('<link rel="canonical" href="https://trouvetaclinique.ca/monteregie/">',
    `<link rel="canonical" href="https://trouvetaclinique.ca/${t.dossier}/">`, 'canonical');
  r('<meta name="robots" content="noindex,follow">',
    '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">', 'robots');
  r('<meta property="og:url" content="https://trouvetaclinique.ca/monteregie/">',
    `<meta property="og:url" content="https://trouvetaclinique.ca/${t.dossier}/">`, 'og:url');
  r('<meta property="og:title" content="Carte complète de la Montérégie | Trouve ta clinique">',
    `<meta property="og:title" content="Cliniques en recrutement : ${t.nom}">`, 'og:title');
  r('<meta property="og:description" content="Carte interactive des cliniques en recrutement et des établissements de la Montérégie.">',
    `<meta property="og:description" content="Carte interactive des cliniques en recrutement et des établissements de la ${t.nom}.">`, 'og:description');
  r('<meta name="twitter:title" content="Carte complète de la Montérégie | Trouve ta clinique">',
    `<meta name="twitter:title" content="Cliniques en recrutement : ${t.nom}">`, 'twitter:title');
  r('<meta name="twitter:description" content="Carte interactive des cliniques en recrutement et des établissements de la Montérégie.">',
    `<meta name="twitter:description" content="Carte interactive des cliniques en recrutement et des établissements de la ${t.nom}.">`, 'twitter:description');
  r('<meta property="og:image" content="https://trouvetaclinique.ca/assets/og-image-accueil.png">',
    '<meta property="og:image" content="https://trouvetaclinique.ca/assets/og-est.png">', 'og:image');
  r('<meta name="twitter:image" content="https://trouvetaclinique.ca/assets/og-image-accueil.png">',
    '<meta name="twitter:image" content="https://trouvetaclinique.ca/assets/og-est.png">', 'twitter:image');

  r('"@id": "https://trouvetaclinique.ca/monteregie/#webpage"',
    `"@id": "https://trouvetaclinique.ca/${t.dossier}/#webpage"`, 'JSON-LD @id');
  r('"name": "Trouve ta clinique · Carte complète de la Montérégie"',
    `"name": "Trouve ta clinique · ${t.nom}"`, 'JSON-LD name');
  r('"url": "https://trouvetaclinique.ca/monteregie/"',
    `"url": "https://trouvetaclinique.ca/${t.dossier}/"`, 'JSON-LD url');
  r('"description": "Carte interactive des cliniques en recrutement médical et des établissements de la Montérégie (Est, Centre et Ouest)."',
    `"description": "Carte interactive des cliniques en recrutement médical et des établissements de la ${t.nom}."`, 'JSON-LD description');
  r('"name": "Montérégie",', `"name": "${t.nom}",`, 'JSON-LD territoire');

  r('<h1 class="sr-only" id="page-h1">Trouve ta clinique · Cliniques en recrutement en Montérégie</h1>',
    `<h1 class="sr-only" id="page-h1">Trouve ta clinique · Cliniques en recrutement en ${t.nom}</h1>`, 'h1');
  r('  Carte interactive des cliniques et points de service qui recrutent des médecins de famille\n  en Montérégie, sur les trois territoires : Montérégie-Est, Montérégie-Centre et\n  Montérégie-Ouest. Pour chaque milieu : coordonnées, type de clinique, réseau local de\n  services, pratiques offertes, horaires et personne-ressource pour le recrutement.',
    `  Carte interactive des cliniques, points de service et établissements de la ${t.nom}, dans\n  les réseaux locaux de services ${phraseRls(t)}. Pour chaque clinique : coordonnées, type de\n  milieu, pratiques offertes, horaires et personne-ressource pour le recrutement.`, 'description accessible');

  if (t.recrutement) {
    r('href="https://www.santemonteregie.qc.ca/recrutement-dtmf-monteregie"',
      `href="${t.recrutement}"`, 'lien recrutement');
  }
  r('      <hr>\n' +
    '      <a class="info-menu-link" role="menuitem" href="https://www.santemonteregie.qc.ca/sites/default/files/2025/06/besoins-etablissement_en-bref_2026v2_0.pdf" target="_blank" rel="noopener">\n' +
    '        <span class="info-menu-ic">⤓</span> Besoins en établissement 2026\n' +
    '      </a>\n' +
    '      <a class="info-menu-link" role="menuitem" href="https://www.santemonteregie.qc.ca/sites/default/files/2025/11/amp-2025_maj-octobre-2025.pdf" target="_blank" rel="noopener">\n' +
    '        <span class="info-menu-ic">⤓</span> Activités médicales particulières (AMP)\n' +
    '      </a>',
    '      <hr>\n' + menuRls(t) + '\n' +
    '      <hr>\n' +
    '      <a class="info-menu-link" role="menuitem" href="ptem/">\n' +
    '        <span class="info-menu-ic">📘</span> Guide PTEM 2027\n' +
    '      </a>\n' +
    '      <a class="info-menu-link" role="menuitem" href="amp/">\n' +
    '        <span class="info-menu-ic">📗</span> Guide des AMP\n' +
    '      </a>', 'menu régional');

  r(':root { --sb-accent: linear-gradient(90deg, var(--logo-blue), var(--logo-teal), var(--logo-mint)); }',
    `:root { --sb-accent: ${t.accent}; }`, 'accent du panneau');
  if (t.couleur && t.halo) {
    r(':root { --mot-region: #ff3d96; --mot-halo: rgba(230,0,126,.8); }',
      `:root { --mot-region: ${t.couleur}; --mot-halo: ${t.halo}; }`, 'couleurs du lettrage régional');
  }
  r('      <span class="ldr-region">MONTÉRÉGIE</span>',
    `      <span class="ldr-region">MONTÉRÉGIE</span>\n      <span class="ldr-mot">${t.mot}</span>`, 'identité du chargement');
  r('    <strong>Montérégie</strong>',
    `    <strong>Montérégie<span class="brand-tiret">-</span><span class="brand-mot">${t.mot}</span></strong>`, 'identité du header');

  if (t.banniere) {
    r('<meta property="og:image:alt" content="Carte des cliniques en recrutement de la Montérégie · Trouve ta clinique.">',
      `<meta property="og:image:alt" content="${t.banniere.alt}">`, 'og:image:alt');
  } else {
    r('<meta property="og:image:alt" content="Carte des cliniques en recrutement de la Montérégie · Trouve ta clinique.">',
      `<meta property="og:image:alt" content="Carte interactive ${t.nom} · Trouve ta clinique.">`, 'og:image:alt');
  }

  if (t.app) {
    r('<!-- PWA_HEAD -->', pwaHead(), 'PWA head');
    r('<!-- PWA_HEADER_BUTTON -->',
      '<button class="btn-install" id="btn-install">⤓ <span class="btn-install-label">Installer la carte Montérégie-Est</span></button>', 'bouton PWA header');
    r('      <!-- PWA_MENU_BUTTON -->',
      '      <hr>\n      <button type="button" class="info-menu-link" role="menuitem" id="info-menu-install">\n        <span class="info-menu-ic">⤓</span> Installer la carte Montérégie-Est\n      </button>', 'bouton PWA menu');
    r('<!-- PWA_SERVICE_WORKER -->', pwaServiceWorker(), 'service worker PWA');
  } else {
    r('<!-- PWA_HEAD -->', '', 'PWA head vide');
    r('<!-- PWA_HEADER_BUTTON -->', '', 'PWA header vide');
    r('      <!-- PWA_MENU_BUTTON -->', '', 'PWA menu vide');
    r('<!-- PWA_SERVICE_WORKER -->', '', 'service worker PWA vide');
  }

  if (etat.manques.length) {
    throw new Error(`${t.nom} : ${etat.manques.length} transformation(s) introuvable(s) :\n  - ` +
      etat.manques.join('\n  - '));
  }
  if (t.region === 'Est') {
    r('<meta name="theme-color" content="#0f2240">',
      '<meta name="theme-color" content="#170A72">', 'theme-color Est SQ');
    const debutStyle = etat.html.indexOf('<style>');
    if (debutStyle < 0) throw new Error('Head de Montérégie-Est introuvable.');
    // L'Est SQ n'utilise pas Raleway/Lato/Kaushan : retirer le chargement Google Fonts
    // hérité du gabarit commun (audit 2 sept. 2026).
    const head = etat.html.slice(0, debutStyle)
      .replace('<html lang="fr-CA">', '<html lang="fr-CA" data-region="Est">')
      .replace(/\n?<link href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*" rel="stylesheet">/g, '');
    const carteSq = fs.readFileSync(SOURCE_EST_SQ, 'utf8').replace(/\r\n/g, '\n');
    if (!carteSq.includes('<!-- PWA_SERVICE_WORKER -->')) {
      throw new Error('Point d’injection PWA absent du gabarit SQ.');
    }
    if (/kaushan/i.test(carteSq) || /kaushan/i.test(head)) {
      throw new Error('Kaushan Script ne doit pas apparaître dans la carte Est SQ.');
    }
    return head + carteSq.replace('<!-- PWA_SERVICE_WORKER -->', pwaServiceWorker());
  }
  if (t.region === 'Centre') {
    r('<html lang="fr-CA">', '<html lang="fr-CA" data-region="Centre" data-etab-ui="1">', 'data-region Centre');
  }
  if (t.region === 'Ouest') {
    r('<html lang="fr-CA">', '<html lang="fr-CA" data-region="Ouest" data-etab-ui="1">', 'data-region Ouest');
  }
  return etat.html;
}

function verifierCarteGenerale(source) {
  const attendus = [
    '<link rel="canonical" href="https://trouvetaclinique.ca/monteregie/">',
    '<!-- PWA_HEAD -->', '<!-- PWA_HEADER_BUTTON -->', '<!-- PWA_MENU_BUTTON -->',
    '<!-- PWA_SERVICE_WORKER -->',
    "fetch('../data.json', { cache: 'no-cache' })"
  ];
  const manques = attendus.filter(x => !source.includes(x));
  if (manques.length) throw new Error('Gabarit de carte incomplet : ' + manques.join(', '));
  if (!source.match(BLOC_HORS_REGION)) throw new Error('Aucun bloc hors-region trouvé dans le gabarit.');
}

function verifierIsolation(sortie, t) {
  const interdits = [
    ['/cliniques/', 'répertoire général'], ['/ptem/', 'guide PTEM général'],
    ['/amp/', 'guide AMP général'], ['/monteregie/', 'carte complète']
  ];
  for (const autre of TERRITOIRES) {
    if (autre.dossier !== t.dossier) interdits.push([`/${autre.dossier}/`, `carte ${autre.nom}`]);
  }
  const lien = chemin => new RegExp('(?:href|src)\\s*=\\s*"[^"]*' +
    chemin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"');
  const fuites = interdits.filter(([chemin]) => lien(chemin).test(sortie));
  if (fuites.length) {
    throw new Error(`${t.nom} contient des liens hors territoire : ` +
      fuites.map(([, libelle]) => libelle).join(', '));
  }
}

function ecrire(cible, contenu) {
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, contenu, 'utf8');
}

/* ------------------------------------------------------------------------------------------- */
/* Index SEO statique sous la carte (lisible sans JavaScript)                                   */
/* Même filtre de base que initData() dans le gabarit : visible, coords, hors catégorie        */
/* établissement pour les cliniques ; données établissements JSON pour les fiches SEO.          */
/* ------------------------------------------------------------------------------------------- */

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugifier(nom) {
  return String(nom)
    .replace(/\u0153/g, 'oe').replace(/\u0152/g, 'Oe').replace(/\u00e6/g, 'ae').replace(/\u00c6/g, 'Ae')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80).replace(/-+$/, '');
}

function coordsValides(g) {
  const lat = (typeof g.lat === 'number' || typeof g.lat === 'string') ? Number(g.lat) : NaN;
  const lng = (typeof g.lng === 'number' || typeof g.lng === 'string') ? Number(g.lng) : NaN;
  const latOk = Number.isFinite(lat) && lat >= -90 && lat <= 90;
  const lngOk = Number.isFinite(lng) && lng >= -180 && lng <= 180;
  const nomOk = typeof g.nom === 'string' && g.nom.trim().length > 0;
  return latOk && lngOk && nomOk;
}

function chargerJson(relatif) {
  return JSON.parse(fs.readFileSync(path.join(RACINE, relatif), 'utf8'));
}

function chargerSlugsCliniques() {
  try {
    return chargerJson(path.join('scripts', 'slugs.json'));
  } catch (_e) {
    return {};
  }
}

function cliniquesCarte(region) {
  const data = chargerJson('data.json');
  const slugs = chargerSlugsCliniques();
  return (data.cliniques || [])
    .filter((g) => {
      if (g.visible === false || g.categorie === 'etablissement') return false;
      if (region && g.region !== region) return false;
      return coordsValides(g);
    })
    .map((g) => ({
      id: g.id,
      nom: g.nom,
      ville: g.ville || '',
      rls: g.rls || '',
      region: g.region || '',
      type: g.type || '',
      recrute: g.recrutementActif !== false,
      slug: slugs[String(g.id)] || slugifier(g.nom)
    }))
    .filter((g) => g.slug)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

function gmfuVersEtablissement() {
  const map = new Map();
  try {
    const donnees = chargerJson('data-etablissements.json');
    for (const inst of donnees.installations || []) {
      if (inst.type !== 'gmf-u') continue;
      const ref = inst.referenceExistante;
      if (ref && ref.collection === 'cliniques' && ref.id != null) {
        map.set(String(ref.id), slugifier(inst.nom));
      }
    }
  } catch (_e) { /* pas de couche Est */ }
  return map;
}

function dossiersEtablissementsPublies(dossierTerritoire) {
  const dir = path.join(RACINE, dossierTerritoire, 'etablissements');
  if (!fs.existsSync(dir)) return new Set();
  return new Set(
    fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  );
}

function etablissementsCarte(t) {
  /* t = territoire TERRITOIRES ou null (carte complète). */
  const lots = [];
  if (!t || t.region === 'Est') {
    try {
      const donnees = chargerJson('data-etablissements.json');
      const publies = dossiersEtablissementsPublies('monteregie-est');
      const rlsNoms = t ? new Set(t.rls.map(([nom]) => nom)) : null;
      for (const inst of donnees.installations || []) {
        if (inst.publication && inst.publication.visible === false) continue;
        const slug = slugifier(inst.nom);
        if (!publies.has(slug)) continue;
        if (t && !inst.missionRegionale && rlsNoms && !rlsNoms.has(inst.territoireSource)) continue;
        lots.push({
          nom: inst.nom,
          ville: inst.ville || '',
          type: inst.type || '',
          rls: inst.missionRegionale ? 'Mission régionale' : (inst.territoireSource || ''),
          region: 'Est',
          dossier: 'monteregie-est',
          slug
        });
      }
    } catch (_e) { /* ignore */ }
  }
  if (!t || t.region === 'Centre') {
    try {
      const donnees = chargerJson('data-etablissements-centre.json');
      const publies = dossiersEtablissementsPublies('monteregie-centre');
      for (const inst of donnees.installations || []) {
        if (inst.publication && inst.publication.visible === false) continue;
        const slug = slugifier(inst.nom);
        if (!publies.has(slug)) continue;
        lots.push({
          nom: inst.nom,
          ville: inst.ville || '',
          type: inst.type || '',
          rls: inst.territoireSource || '',
          region: 'Centre',
          dossier: 'monteregie-centre',
          slug
        });
      }
    } catch (_e) { /* ignore */ }
  }
  return lots.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

function villesPrincipales(cliniques, max = 8) {
  const compte = new Map();
  for (const c of cliniques) {
    const v = (c.ville || '').trim();
    if (!v) continue;
    compte.set(v, (compte.get(v) || 0) + 1);
  }
  return [...compte.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
    .slice(0, max)
    .map(([v]) => v);
}

function phraseVilles(villes) {
  if (!villes.length) return '';
  if (villes.length === 1) return villes[0];
  const copie = villes.slice();
  const dernier = copie.pop();
  return copie.join(', ') + ' et ' + dernier;
}

function htmlListeLiens(items) {
  if (!items.length) return '';
  return '<ul class="repertoire-liste">\n' + items.map((it) =>
    `  <li><a href="${escHtml(it.href)}">${escHtml(it.label)}</a>` +
    (it.meta ? ` <span class="repertoire-meta">${escHtml(it.meta)}</span>` : '') +
    '</li>'
  ).join('\n') + '\n</ul>';
}

function compterTypesCliniques(cliniques) {
  let gmf = 0;
  let gmfu = 0;
  let gmfr = 0;
  let autres = 0;
  for (const c of cliniques) {
    const t = String(c.type || '').toLowerCase();
    if (t === 'gmf-u' || t.includes('gmf-u')) gmfu++;
    else if (t === 'gmf-r' || t.includes('gmf-r')) gmfr++;
    else if (t === 'gmf' || /(^|\s)gmf(\s|$)/.test(t)) gmf++;
    else autres++;
  }
  return { gmf, gmfu, gmfr, autres };
}

function phraseComposition(types) {
  const bits = [];
  if (types.gmf) bits.push(`${types.gmf} GMF`);
  if (types.gmfu) bits.push(`${types.gmfu} GMF-U`);
  if (types.gmfr) bits.push(`${types.gmfr} GMF-R`);
  if (types.autres) bits.push(`${types.autres} clinique${types.autres > 1 ? 's' : ''} médicale${types.autres > 1 ? 's' : ''}`);
  if (!bits.length) return '';
  if (bits.length === 1) return bits[0];
  const dernier = bits.pop();
  return bits.join(', ') + ' et ' + dernier;
}

function htmlIntroTerritoire(t, cliniques, etablissements) {
  const nRls = t ? t.rls.length : TERRITOIRES.reduce((n, x) => n + x.rls.length, 0);
  const nRecrute = cliniques.filter((c) => c.recrute).length;
  const nTotal = cliniques.length;
  const villes = phraseVilles(villesPrincipales(cliniques, 8));
  const nom = t ? t.nom : 'Montérégie';
  const nomsRls = t
    ? phraseVilles(t.rls.map(([n]) => n))
    : phraseVilles(TERRITOIRES.flatMap((x) => x.rls.map(([n]) => n)));
  const composition = phraseComposition(compterTypesCliniques(cliniques));

  let p1 = t
    ? `La ${nom} couvre ${nRls === 1 ? 'le' : 'les'} RLS ${nomsRls}.`
    : `La carte complète regroupe les ${nRls} RLS des trois territoires de la Montérégie (${phraseVilles(TERRITOIRES.map((x) => x.nom))}).`;
  if (nTotal) {
    p1 += ` On y trouve ${nTotal} clinique${nTotal > 1 ? 's' : ''} de médecine familiale`;
    if (composition) p1 += ` — ${composition}`;
    p1 += '.';
  }

  let p2 = nRecrute
    ? `${nRecrute} d’entre elles recrute${nRecrute > 1 ? 'nt' : ''} actuellement des médecins de famille`
    : 'Aucune clinique n’est marquée en recrutement pour le moment';
  if (villes) p2 += `, notamment à ${villes}`;
  p2 += '.';

  let p3 = '';
  if (etablissements.length) {
    p3 = `${etablissements.length} établissement${etablissements.length > 1 ? 's' : ''} (hôpitaux, CHSLD, GMF-U et autres) affichent aussi des secteurs en recrutement sur ce territoire.`;
  } else if (nTotal > nRecrute) {
    const hors = nTotal - nRecrute;
    p3 = `${hors} autre${hors > 1 ? 's' : ''} milieu${hors > 1 ? 'x' : ''} ${hors > 1 ? 'sont publiés' : 'est publié'} à titre de référence, sans recrutement ouvert.`;
  }

  return `<p>${escHtml(p1)}</p>\n<p>${escHtml(p2)}</p>` + (p3 ? `\n<p>${escHtml(p3)}</p>` : '');
}

function htmlBlocRls(t) {
  const lignes = [];
  const territoires = t ? [t] : TERRITOIRES;
  for (const ter of territoires) {
    for (const [nom, , slug] of ter.rls) {
      const href = t
        ? `rls/${slug}/`
        : `/${ter.dossier}/rls/${slug}/`;
      lignes.push({
        href,
        label: t ? `RLS ${nom}` : `${ter.nom} · RLS ${nom}`
      });
    }
  }
  const more = t
    ? `<p class="repertoire-suite"><a href="rls/">Parcourir les pages RLS de ${escHtml(t.nom)} →</a></p>`
    : `<p class="repertoire-suite"><a href="/monteregie-est/rls/">RLS Montérégie-Est</a> · <a href="/monteregie-centre/rls/">Montérégie-Centre</a> · <a href="/monteregie-ouest/rls/">Montérégie-Ouest</a></p>`;
  return `
<section class="repertoire-section" id="repertoire-rls">
  <h2>Réseaux locaux de services</h2>
  ${htmlListeLiens(lignes)}
  ${more}
</section>`;
}

function htmlBlocCliniques(t, cliniques, gmfuMap) {
  const territoires = t ? [t] : TERRITOIRES;
  const sections = [];
  for (const ter of territoires) {
    const ordreRls = ter.rls.map(([nom]) => nom);
    const parRls = new Map();
    for (const c of cliniques) {
      if (c.region !== ter.region) continue;
      const cle = c.rls || 'Autre';
      if (!parRls.has(cle)) parRls.set(cle, []);
      parRls.get(cle).push(c);
    }
    const ordre = [...ordreRls.filter((n) => parRls.has(n)), ...[...parRls.keys()].filter((n) => !ordreRls.includes(n)).sort((a, b) => a.localeCompare(b, 'fr'))];
    for (const rlsNom of ordre) {
      const liste = parRls.get(rlsNom) || [];
      const items = liste.map((c) => {
        const slugEtab = gmfuMap.get(String(c.id));
        let href;
        if (slugEtab && (!t || t.region === 'Est')) {
          /* Canonique GMF-U : fiche établissement Est (évite la page clinique qui redirige). */
          href = t ? `etablissements/${slugEtab}/` : `/monteregie-est/etablissements/${slugEtab}/`;
        } else if (t) {
          href = `cliniques/${c.slug}/`;
        } else {
          const dos = TERRITOIRES.find((x) => x.region === c.region);
          href = `/${dos ? dos.dossier : 'monteregie-est'}/cliniques/${c.slug}/`;
        }
        return {
          href,
          label: c.nom,
          meta: [c.ville, c.recrute ? null : 'ne recrute pas actuellement'].filter(Boolean).join(' · ')
        };
      });
      const titre = t
        ? `Cliniques · RLS ${rlsNom}`
        : `${ter.nom} · RLS ${rlsNom}`;
      sections.push(`
<section class="repertoire-section" id="repertoire-cliniques-${slugifier(ter.region + '-' + rlsNom)}">
  <h2>${escHtml(titre)}</h2>
  ${htmlListeLiens(items)}
</section>`);
    }
  }
  const more = t
    ? `<p class="repertoire-suite"><a href="cliniques/">Répertoire des cliniques de ${escHtml(t.nom)} →</a></p>`
    : `<p class="repertoire-suite"><a href="/monteregie-est/cliniques/">Répertoire Montérégie-Est</a> · <a href="/monteregie-centre/cliniques/">Montérégie-Centre</a> · <a href="/monteregie-ouest/cliniques/">Montérégie-Ouest</a></p>`;
  return sections.join('\n') + '\n' + more;
}

function htmlBlocEtablissements(t, etablissements) {
  if (!etablissements.length) return '';
  const items = etablissements.map((e) => ({
    href: t ? `etablissements/${e.slug}/` : `/${e.dossier}/etablissements/${e.slug}/`,
    label: e.nom,
    meta: [e.ville, e.rls].filter(Boolean).join(' · ')
  }));
  const more = t
    ? (t.region === 'Ouest'
      ? ''
      : `<p class="repertoire-suite"><a href="etablissements/">Secteurs en établissement →</a></p>`)
    : `<p class="repertoire-suite"><a href="/monteregie-est/etablissements/">Établissements Montérégie-Est</a> · <a href="/monteregie-centre/etablissements/">Montérégie-Centre</a></p>`;
  return `
<section class="repertoire-section" id="repertoire-etablissements">
  <h2>Établissements</h2>
  ${htmlListeLiens(items)}
  ${more}
</section>`;
}

function htmlIndexSeoTerritoire(t) {
  const cliniques = cliniquesCarte(t ? t.region : null);
  const etablissements = etablissementsCarte(t);
  const gmfuMap = gmfuVersEtablissement();
  const titre = t
    ? `Répertoire de la ${t.nom}`
    : 'Répertoire de la Montérégie';
  const style = `
<style id="repertoire-territoire-css">
/* Annuaire sous la carte : visible aux humains (défilement) et aux robots (HTML statique).
   Annule position:fixed / overflow:hidden des gabarits carte pour que le document défile. */
html, body {
  position: static !important;
  inset: auto !important;
  top: auto !important;
  right: auto !important;
  bottom: auto !important;
  left: auto !important;
  width: 100% !important;
  height: auto !important;
  max-height: none !important;
  min-height: 100%;
  overflow-x: hidden !important;
  overflow-y: auto !important;
}
.layout {
  height: 100vh !important;
  height: 100dvh !important;
  max-height: 100dvh;
  flex-shrink: 0;
}
#repertoire-territoire {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
  clip: auto !important;
  position: relative !important;
  left: auto !important;
  top: auto !important;
  z-index: 2;
  box-sizing: border-box;
  max-width: 52rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;
  font-family: "Segoe UI", system-ui, sans-serif;
  color: #0f172a;
  background: #f8fafc;
  border-top: 4px solid #0080d7;
  line-height: 1.5;
}
#repertoire-territoire h2 { font-size: 1.15rem; margin: 1.6rem 0 .6rem; color: #170a72; }
#repertoire-territoire > h2:first-of-type { margin-top: 0; }
#repertoire-territoire p { margin: .55rem 0; }
#repertoire-territoire .repertoire-liste { margin: .4rem 0 0; padding-left: 1.2rem; }
#repertoire-territoire .repertoire-liste li { margin: .25rem 0; }
#repertoire-territoire a { color: #0080d7; }
#repertoire-territoire .repertoire-meta { color: #64748b; font-size: .92em; }
#repertoire-territoire .repertoire-suite { margin-top: .75rem; }
</style>`;
  return `${style}
<nav id="repertoire-territoire" aria-label="Répertoire des milieux du territoire">
  <h2>${escHtml(titre)}</h2>
  ${htmlIntroTerritoire(t, cliniques, etablissements)}
  ${htmlBlocRls(t)}
  ${htmlBlocCliniques(t, cliniques, gmfuMap)}
  ${htmlBlocEtablissements(t, etablissements)}
</nav>`;
}

function injecterIndexSeo(html, t) {
  const bloc = htmlIndexSeoTerritoire(t);
  if (!html.includes('</body>')) {
    throw new Error('Balise </body> introuvable pour injecter le répertoire territorial.');
  }
  /* Remplace un ancien bloc s’il existe (renommage index-seo → repertoire). */
  let out = html
    .replace(/<style id="(?:seo-index|repertoire)-territoire-css">[\s\S]*?<\/style>\s*/g, '')
    .replace(/<nav id="(?:index-seo|repertoire)-territoire"[\s\S]*?<\/nav>\s*/g, '');
  return out.replace('</body>', `${bloc}\n</body>`);
}

function main() {
  const source = fs.readFileSync(SOURCE, 'utf8');
  verifierCarteGenerale(source);

  // La carte complète n'est pas installable. Les commentaires de substitution sont inoffensifs
  // et facilitent le contrôle visuel du gabarit; aucune balise manifest ni aucun bouton n'existe.
  const generale = injecterIndexSeo(
    source.replace('<html lang="fr-CA">', '<html lang="fr-CA" data-etab-ui="1">'),
    null
  );
  ecrire(SORTIE_GENERALE, generale);
  console.log('  monteregie/index.html régénéré (carte complète, non installable + index SEO).');

  for (const t of TERRITOIRES) {
    let sortie = appliquerIdentiteRegionale(source, t);
    sortie = injecterIndexSeo(sortie, t);
    verifierIsolation(sortie, t);
    ecrire(path.join(RACINE, t.dossier, 'index.html'), sortie);
    console.log(`  ${t.dossier}/index.html régénéré (${t.rls.length} RLS, ${t.app ? 'PWA' : 'carte seule'} + index SEO).`);
  }
  console.log('4 cartes régénérées : gabarit partagé et prototype SQ conservé pour l’Est.');
}

main();
