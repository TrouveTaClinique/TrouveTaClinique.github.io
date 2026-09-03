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
const CACHE = CACHE_PREFIX + 'v57-rls-contour';
const ANCIEN_PREFIX = 'ptem-2027-';

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

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key !== CACHE &&
          (key.startsWith(CACHE_PREFIX) || key.startsWith(ANCIEN_PREFIX)))
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
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
