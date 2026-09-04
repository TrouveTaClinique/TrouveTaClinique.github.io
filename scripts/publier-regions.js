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
      url: 'https://trouvetaclinique.ca/assets/banniere_monteregie-est.jpg',
      largeur: '1024', hauteur: '341',
      alt: 'Carte interactive Montérégie-Est — Trouve ta clinique.'
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
    `        <span class="info-menu-ic" style="background:${couleur}">📋</span> Cliniques — RLS ${nom}\n` +
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

  r('<title>Carte complète de la Montérégie — Cliniques en recrutement</title>',
    `<title>Cliniques en recrutement — ${t.nom}</title>`, 'titre');
  r('<meta name="description" content="Explorez la carte complète des cliniques en recrutement et des établissements de la Montérégie pour préparer votre PTEM en médecine familiale.">',
    `<meta name="description" content="Carte interactive des cliniques en recrutement et des établissements de la ${t.nom}, pour préparer votre PTEM en médecine familiale.">`, 'description');
  r('<link rel="canonical" href="https://trouvetaclinique.ca/monteregie/">',
    `<link rel="canonical" href="https://trouvetaclinique.ca/${t.dossier}/">`, 'canonical');
  r('<meta name="robots" content="noindex,follow">',
    '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">', 'robots');
  r('<meta property="og:url" content="https://trouvetaclinique.ca/monteregie/">',
    `<meta property="og:url" content="https://trouvetaclinique.ca/${t.dossier}/">`, 'og:url');
  r('<meta property="og:title" content="Carte complète de la Montérégie | Trouve ta clinique">',
    `<meta property="og:title" content="Cliniques en recrutement — ${t.nom}">`, 'og:title');
  r('<meta property="og:description" content="Carte interactive des cliniques en recrutement et des établissements de la Montérégie.">',
    `<meta property="og:description" content="Carte interactive des cliniques en recrutement et des établissements de la ${t.nom}.">`, 'og:description');
  r('<meta name="twitter:title" content="Carte complète de la Montérégie | Trouve ta clinique">',
    `<meta name="twitter:title" content="Cliniques en recrutement — ${t.nom}">`, 'twitter:title');
  r('<meta name="twitter:description" content="Carte interactive des cliniques en recrutement et des établissements de la Montérégie.">',
    `<meta name="twitter:description" content="Carte interactive des cliniques en recrutement et des établissements de la ${t.nom}.">`, 'twitter:description');

  r('"@id": "https://trouvetaclinique.ca/monteregie/#webpage"',
    `"@id": "https://trouvetaclinique.ca/${t.dossier}/#webpage"`, 'JSON-LD @id');
  r('"name": "Trouve ta clinique — Carte complète de la Montérégie"',
    `"name": "Trouve ta clinique — ${t.nom}"`, 'JSON-LD name');
  r('"url": "https://trouvetaclinique.ca/monteregie/"',
    `"url": "https://trouvetaclinique.ca/${t.dossier}/"`, 'JSON-LD url');
  r('"description": "Carte interactive des cliniques en recrutement médical et des établissements de la Montérégie (Est, Centre et Ouest)."',
    `"description": "Carte interactive des cliniques en recrutement médical et des établissements de la ${t.nom}."`, 'JSON-LD description');
  r('"name": "Montérégie",', `"name": "${t.nom}",`, 'JSON-LD territoire');

  r('<h1 class="sr-only" id="page-h1">Trouve ta clinique — Cliniques en recrutement en Montérégie</h1>',
    `<h1 class="sr-only" id="page-h1">Trouve ta clinique — Cliniques en recrutement en ${t.nom}</h1>`, 'h1');
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
    r('<meta property="og:image:alt" content="Carte des cliniques en recrutement de la Montérégie — Trouve ta clinique.">',
      `<meta property="og:image:alt" content="${t.banniere.alt}">`, 'og:image:alt');
  } else {
    r('<meta property="og:image:alt" content="Carte des cliniques en recrutement de la Montérégie — Trouve ta clinique.">',
      `<meta property="og:image:alt" content="Carte interactive ${t.nom} — Trouve ta clinique.">`, 'og:image:alt');
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

function main() {
  const source = fs.readFileSync(SOURCE, 'utf8');
  verifierCarteGenerale(source);

  // La carte complète n'est pas installable. Les commentaires de substitution sont inoffensifs
  // et facilitent le contrôle visuel du gabarit; aucune balise manifest ni aucun bouton n'existe.
  ecrire(SORTIE_GENERALE, source);
  console.log('  monteregie/index.html régénéré (carte complète, non installable).');

  for (const t of TERRITOIRES) {
    const sortie = appliquerIdentiteRegionale(source, t);
    verifierIsolation(sortie, t);
    ecrire(path.join(RACINE, t.dossier, 'index.html'), sortie);
    console.log(`  ${t.dossier}/index.html régénéré (${t.rls.length} RLS, ${t.app ? 'PWA' : 'carte seule'}).`);
  }
  console.log('4 cartes régénérées : gabarit partagé et prototype SQ conservé pour l’Est.');
}

main();
