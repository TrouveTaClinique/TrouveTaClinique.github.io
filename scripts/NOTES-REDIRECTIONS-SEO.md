# Redirections SEO — notes de migration

## Ce qui est en place dans le dépôt

Les anciennes URL (`/ptem/`, `/amp/`, `/cliniques/…`, fiches générales) servent une
page HTML qui :

1. annonce `noindex` + `canonical` vers la nouvelle adresse ;
2. fait un `meta refresh` immédiat ;
3. exécute `location.replace` **en conservant** `location.search` et `location.hash`
   (ancres des guides, paramètres partagés).

GitHub Pages ne fournit pas de HTTP 301 natif.

## À configurer côté Cloudflare (domaine trouvetaclinique.ca)

Dès que le proxy Cloudflare est actif, préférer des **Redirect Rules** 301 pour les
URL à fort trafic de l’export Search Console :

| Source | Destination 301 |
|---|---|
| `/ptem` et `/ptem/` | `/monteregie-est/ptem/` |
| `/amp` et `/amp/` | `/monteregie-est/amp/` |
| `/cliniques/` | `/monteregie-est/cliniques/` |
| `/cliniques/clinique-medicale-les-2-chenes/` | `/monteregie-est/cliniques/clinique-medicale-les-2-chenes/` |

Conserver query string et fragment dans la règle Cloudflare (« Preserve query string »).

Après bascule brouillon → main, surveiller dans Search Console : erreurs 404,
canonique retenue, clics sur Les 2 Chênes et `/ptem/`.
