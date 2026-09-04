# Redirections SEO — notes de migration

## Ce qui est en place dans le dépôt

Les anciennes URL (`/ptem/`, `/amp/`, `/cliniques/…`, `/rls/…`, fiches générales, fiches
GMF-U désormais fusionnées vers `/etablissements/`) servent une page HTML qui :

1. annonce `noindex` + `canonical` vers l’URL de production ;
2. fait un `meta refresh` immédiat **vers le chemin relatif** (même hôte : aperçu, localhost) ;
3. exécute `location.replace` sur ce chemin **en conservant** `location.search` et `location.hash`.

GitHub Pages ne fournit pas de HTTP 301 natif. Le domaine est aujourd’hui servi par
GitHub Pages / Fastly (pas de `cf-ray` sur les réponses live du 4 septembre 2026).

## Cloudflare — 301 réels

Le fichier généré `scripts/cloudflare-bulk-redirects.csv` liste **toutes** les
redirections HTML du dépôt. Format Cloudflare : **pas d’en-tête**, colonnes
source, cible, 301, conserve la query string, sans sous-domaines, sans sous-chemins.

1. Dans Cloudflare, passer `trouvetaclinique.ca` et `www` en **proxied** (nuage orange).
   Laisser `apercu` en DNS only (nuage gris). Tant que le DNS production est gris,
   les Bulk Redirects ne s’appliquent pas.
2. Account → Bulk Redirects → créer une liste → importer le CSV → créer une
   Bulk Redirect Rule qui utilise cette liste → Save and Deploy.
3. Ne pas cocher « Include subdomains » ni « Subpath matching » (le CSV les force déjà à FALSE).

Règles dynamiques **à ne pas** utiliser : `/cliniques/*` → `/monteregie-est/cliniques/*`
casserait les fiches Centre et Ouest, dont la cible officielle n’est pas l’Est.

Après activation, surveiller dans Search Console : `/ptem/`, `/cliniques/`, `/rls/champlain/`,
et les deux GMF-U (`…/cliniques/gmf-u-des-monteregiennes/` → `…/etablissements/…`).
