# Mission 04 : sécurité technique

Rapport : `audit-cursor/rapports/04-securite-technique.md`.

## Étapes
1. **Robots GitHub** (`.github/workflows/*.yml`) : permissions du jeton, actions épinglées
   (version ou empreinte), déclencheurs, usage des secrets (`APERCU_DEPLOY_TOKEN` et autres),
   risque d'injection par des données non fiables dans les commandes `run:` (titres, messages),
   étapes de vérification des fuites, comportement en cas d'échec.
2. **Service d'IA et formulaire** (`workers/aiguillage/`) : lecture du code et des tests.
   Contrôle d'origine (rappel : un en-tête `Origin` se falsifie), limites de débit, plafond
   quotidien (compteur KV non atomique), taille des requêtes, validation des entrées, injection
   dans le prompt, fuite d'information dans les messages d'erreur, journalisation, route
   `/contact` (pourriel, injection d'en-têtes de courriel). Lance
   `node --test workers/aiguillage/test/logique.test.js`. **N'appelle jamais le service en ligne.**
3. **Pages et scripts du site** : usage de `innerHTML` ou équivalent avec des données (risque
   XSS si une donnée contient du HTML), liens `target="_blank"` sans `rel="noopener"`,
   `localStorage`, service workers (portée, risque de servir une vieille version), scripts et
   feuilles tiers (domaines, versions épinglées, intégrité SRI), absence de politique CSP
   (GitHub Pages ne permet pas d'en-têtes ; une balise `meta` est possible).
4. **Clés visibles dans les pages** : clé CARTO, fichier IndexNow, fichier de vérification Google.
   Sont-elles publiques par nature ? Quelles protections recommander (restriction de domaine
   chez le fournisseur, rotation) ? Ne recopie aucune valeur.
5. **Dépendances** : versions de Leaflet, MapLibre et autres fichiers de `vendor/` ou de CDN ;
   failles connues publiées pour ces versions (cite la source).

## À rendre
Le rapport habituel, constats classés par gravité.
