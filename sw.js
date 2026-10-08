// PWA Montérégie-Est seulement. La portée est fixée à /monteregie-est/ lors de l'enregistrement.
// Historique des versions du cache : CHANGELOG.md, section « Cache de la carte Est » (sorti d'ici
// pour alléger ce fichier, téléchargé par chaque visiteur). Augmenter CACHE quand une ressource
// mise en cache change.
'use strict';

const CACHE_PREFIX = 'trouve-clinique-est-';
const CACHE = CACHE_PREFIX + 'v106-courriels';
const ANCIEN_PREFIX = 'ptem-2027-';

/* Portée légitime de cette PWA. Toute autre portée (en pratique « / ») vient d'un
   enregistrement hérité d'avant la migration v52. Ce fichier est resté à la même adresse
   (/sw.js) : le navigateur y met donc à jour l'ancien enregistrement racine, et c'est le
   seul endroit d'où l'on peut encore reprendre la main sur lui : une page servie depuis
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
     donc l'activation, donc le ménage, exactement ce qu'on veut éviter. */
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
 * bonne au clic suivant. Aucun script de page ne pouvait corriger cela : la page périmée
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
