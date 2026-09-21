// PWA Montérégie-Est seulement. La portée est fixée à /monteregie-est/ lors de l'enregistrement.
// v52 (31 août 2026) : retrait du mode hors ligne des cartes générale, Centre et Ouest;
// ajout de la couche Établissements et migration de la carte complète vers /monteregie/.
// v53-sq-restaure (1 septembre 2026) : reprise du prototype SQ et du bouton d'information.
'use strict';

const CACHE_PREFIX = 'trouve-clinique-est-';
// v54-secteurs-etablissements (2 septembre 2026) : couche data-etablissements.json pour l'onglet Établissements.
// v56-fiche-installation (2 septembre 2026) : fiche centrée sur l'installation avec accordéon
// de secteurs, sélection multiple d'activités, territoires en une ligne défilante.
// v57-rls-contour (3 septembre 2026) : boutons RLS établissements en contour, une ligne
// sans défilement ; libellé de type mint sur le thème Est.
// v58-territoire-repli (3 septembre 2026) : boutons RLS établissements pleins par défaut,
// bloc Territoire replié, compteur « X secteurs dans Y installations » retiré.
// v59-hopitaux-h (3 septembre 2026) : goutte H rouge pour les 3 hôpitaux ; numéros
// d'identification 1–n sur les autres repères établissements.
// v60-pins-cliniques (3 septembre 2026) : gouttes cliniques 24/32 px, regroupement
// par proximité écran aussi en mode cliniques.
// v61-panneau-scroll (3 septembre 2026) : bulle i établissements retirée ;
// tête du panneau fixe, liste et secteurs d'activité défilent ensemble.
// v62-territoire-fixe (3 septembre 2026) : les 4 boutons de territoire restent
// visibles, sans sous-titre ni repli.
// v63-sante-quebec (4 septembre 2026) : dénomination « Santé Québec Montérégie-Est » partout et
// renommage de l'identifiant des territoires dans territoires-monteregie.js (ressource en cache).
// v64-accueil-fraiche (4 septembre 2026) : auto-destruction de l'ancien enregistrement de
// portée « / », qui servait encore une page d'accueil périmée au premier chargement.
// v65-seo-meta (4 septembre 2026) : lang fr-CA, noindex de /monteregie/, OG 1200×630,
// meta Search Console retirée des cartes (conservée sur l’accueil).
// v67-icones-blanc (8 septembre 2026) : icônes d’installation fond blanc, depuis le pin 512.
/* 18 sept 2026 — thème aperçu (header/footer/héros, palette marque). */
// v71-hero-guide-gutter (18 septembre 2026) : plus de double gutter sur .hero-guide
// (main porte déjà le padding-inline).
// v72-site-polish (18 septembre 2026) : logo haute définition, recherche rapide restaurée,
// accueil repoli et vidéo déplacée du répertoire Cliniques vers Établissements.
// v73-logo-officiel-hd (18 septembre 2026) : logo et icônes depuis la source officielle HD
// sur fond blanc ; cache des assets marque à rafraîchir.
// v74-logo-source (18 septembre 2026) : nouvelle source logo officielle (fond noir → blanc).
// v75-logo-footer-blanc (18 septembre 2026) : logo transparent + invert footer (silhouette blanche).
// v76-largeur-sources (18 septembre 2026) : largeurs pages + boutons Source discrets.
// v77-colonne-elargie (18 septembre 2026) : colonne contenu ~72rem (gutter 36rem).
// v78-rappel-apropos (18 septembre 2026) : largeur encadrés accueil + texte À propos.
// v79-colonne-62rem (18 septembre 2026) : colonne contenu ~62rem ; héros toujours plein écran.
// v80-hero-colonne (18 septembre 2026) : héros aligné sur la même largeur que le reste du site.
// v81-recherche-ptem (18 septembre 2026) : puce PTEM → page guide ; libellé « Parcourez directement ».
// v82-rls-est-vert (18 septembre 2026) : pastilles RLS Montérégie-Est en vert.
// v84-projection-etablissements (20 septembre 2026) : /data-etablissements.json ne sert plus
// que la projection publique (courriels des responsables retirés selon la politique du fichier).
// L'URL reste dans CORE : même chemin, mêmes champs publics, la carte est inchangée. Le cache
// doit être renouvelé pour que les anciennes copies du JSON brut soient supprimées.
// v86-design-cadre (20 septembre 2026) : bandeau plus lisible, cadre 1400 px, section carte commune, guides PTEM/AMP.
// v87-guides-animation (21 septembre 2026) : guides plus lisibles, alternance blanc/vert et animation réversible.\nconst CACHE = CACHE_PREFIX + 'v87-guides-animation';
const ANCIEN_PREFIX = 'ptem-2027-';

/* Portée légitime de cette PWA. Toute autre portée (en pratique « / ») vient d'un
   enregistrement hérité d'avant la migration v52. Ce fichier est resté à la même adresse
   (/sw.js) : le navigateur y met donc à jour l'ancien enregistrement racine, et c'est le
   seul endroit d'où l'on peut encore reprendre la main sur lui — une page servie depuis
   son cache ne contient, par définition, aucun de nos scripts récents. */
const PORTEE_EST = '/monteregie-est/';

const CORE = [
  '/monteregie-est/',
  '/monteregie-est/index.html',
  '/data.json',
  '/data-etablissements.json',
  '/territoires-monteregie.js',
  '/territoires-rls-est.js',
  '/leaflet.css',
  '/leaflet.js',
  '/vendor/maplibre-gl.css',
  '/vendor/maplibre-gl.js',
  '/vendor/leaflet-maplibre-gl.js',
  '/manifest-est.webmanifest',
  '/icon-est-192.png',
  '/icon-est-512.png',
  '/icon-est-192-maskable.png',
  '/icon-est-512-maskable.png',
  '/apple-touch-icon-est.png',
  '/favicon-16.png',
  '/favicon-32.png',
  '/favicon-48.png'
];

const CORE_PATHS = new Set(CORE);
const MUTABLES = new Set([
  '/data.json',
  '/data-etablissements.json', '/territoires-monteregie.js', '/territoires-rls-est.js'
]);

function porteeLegitime() {
  try { return new URL(self.registration.scope).pathname === PORTEE_EST; } catch (e) { return false; }
}

self.addEventListener('install', event => {
  /* Sous une portée héritée, on ne précharge rien : ce worker n'existe que pour se
     supprimer à l'activation. Un addAll() qui échouerait ferait échouer l'installation,
     donc l'activation, donc le ménage — exactement ce qu'on veut éviter. */
  if (!porteeLegitime()) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

/*
 * Un ancien service worker de portée « / » continuait de servir sa page d'accueil en cache :
 * le visiteur qui tapait trouvetaclinique.ca tombait sur l'ancienne page, puis obtenait la
 * bonne au clic suivant. Aucun script de page ne pouvait corriger cela — la page périmée
 * venait du cache et ne contenait pas nos scripts. La reprise se fait donc ici : quand cette
 * mise à jour s'active sous une portée qui n'est pas /monteregie-est/, c'est l'ancien
 * enregistrement racine. On le supprime, puis on recharge ses fenêtres pour qu'elles
 * repartent du réseau. Sans boucle possible : l'enregistrement disparaît du même coup.
 */
function detruireEnregistrementRacine() {
  let portee;
  try { portee = new URL(self.registration.scope).pathname; } catch (e) { return Promise.resolve(); }
  if (portee === PORTEE_EST) return Promise.resolve();

  return self.clients.matchAll({ type: 'window' })
    .then(fenetres => {
      const aRecharger = fenetres.filter(f => {
        try { return new URL(f.url).pathname.indexOf(PORTEE_EST) !== 0; } catch (e) { return false; }
      });
      return self.registration.unregister()
        .catch(() => {})
        .then(() => Promise.all(aRecharger.map(f =>
          (f.navigate ? f.navigate(f.url).catch(() => {}) : Promise.resolve()))));
    })
    .catch(() => {});
}

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key !== CACHE &&
          (key.startsWith(CACHE_PREFIX) || key.startsWith(ANCIEN_PREFIX)))
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => detruireEnregistrementRacine())
  );
});

function reseauPuisCache(request, cacheKey) {
  return fetch(request, { cache: 'no-store' }).then(response => {
    if (response && response.ok) {
      const copie = response.clone();
      caches.open(CACHE).then(cache => cache.put(cacheKey || request, copie)).catch(() => {});
    }
    return response;
  }).catch(() => caches.match(cacheKey || request));
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const accueilEst = url.pathname === '/monteregie-est/' ||
    url.pathname === '/monteregie-est/index.html';

  // Filet de migration : un ancien service worker pouvait avoir la portée « / ». Même dans ce
  // cas, la nouvelle version ne répond jamais pour l'accueil, la carte complète, Centre, Ouest
  // ou les pages SEO. Elle laisse ces requêtes suivre le réseau normalement.
  if (!accueilEst && !CORE_PATHS.has(url.pathname)) return;

  if (request.mode === 'navigate') {
    if (!accueilEst) return;
    event.respondWith(reseauPuisCache(request, '/monteregie-est/index.html')
      .then(response => response || caches.match('/monteregie-est/index.html')));
    return;
  }

  if (MUTABLES.has(url.pathname)) {
    event.respondWith(reseauPuisCache(request));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const miseAJour = fetch(request).then(response => {
        if (response && response.ok) {
          const copie = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copie)).catch(() => {});
        }
        return response;
      }).catch(() => cached);
      return cached || miseAJour;
    })
  );
});
