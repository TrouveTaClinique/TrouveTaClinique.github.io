// Service worker de l'application « Guides » (portée /guides/ seulement).
// Indépendant de /sw.js (PWA Montérégie-Est) : il ne répond qu'aux requêtes des pages de l'app
// (guides cliniques et ressources communautaires) et de leurs fichiers.
// Pages : réseau d'abord, copie hors ligne en secours (une copie par page).
// Fichiers statiques : cache d'abord, rafraîchi en arrière-plan.
'use strict';

const CACHE = 'ttc-guides-v6';
const PAGE = '/guides/';
const PAGES = ['/guides/', '/guides/ressources-communautaires/'];
const PRECHARGE = [
  ...PAGES,
  '/guides/manifest.webmanifest',
  '/guides/icon-192.png',
  '/guides/icon-512.png'
];
// Fichiers servis hors de /guides/ mais nécessaires à la page (feuilles de style, scripts, logo).
const STATIQUES = /^\/(assets\/(seo-pages|guides-[a-z-]+)\.(css|js)|assets\/logo-128\.webp|favicon-32\.png)$/;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECHARGE))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms
        .filter(nom => nom.startsWith('ttc-guides-') && nom !== CACHE)
        .map(nom => caches.delete(nom))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const requete = event.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  if (requete.mode === 'navigate') {
    if (!url.pathname.startsWith(PAGE)) return;
    /* Copie rangée sous l'adresse de la page, sans ?q= ni #ancre ; page inconnue : les guides. */
    const cle = PAGES.find(p => p === url.pathname || p === url.pathname + '/') || PAGE;
    event.respondWith(
      fetch(requete, { cache: 'no-store' })
        .then(reponse => {
          if (reponse && reponse.ok && !reponse.redirected) {
            const copie = reponse.clone();
            caches.open(CACHE).then(cache => cache.put(cle, copie)).catch(() => {});
          }
          return reponse;
        })
        .catch(() => caches.match(cle).then(r => r || caches.match(PAGE)))
    );
    return;
  }

  if (!url.pathname.startsWith(PAGE) && !STATIQUES.test(url.pathname)) return;
  if (url.pathname === PAGE + 'donnees.json') return;

  event.respondWith(
    caches.match(requete).then(enCache => {
      const reseau = fetch(requete).then(reponse => {
        if (reponse && reponse.ok) {
          const copie = reponse.clone();
          caches.open(CACHE).then(cache => cache.put(requete, copie)).catch(() => {});
        }
        return reponse;
      }).catch(() => enCache);
      return enCache || reseau;
    })
  );
});
