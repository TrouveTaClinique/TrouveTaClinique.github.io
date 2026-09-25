# Trouve ta clinique : règles du projet

Site statique (GitHub Pages) pour les médecins de famille et les résidents qui cherchent un milieu
de pratique en Montérégie : cartes, fiches de cliniques, guides PTEM / PTEM-U / AMP, catalogue
de guides cliniques. Tout le contenu public est en français du Québec. Le propriétaire préfère
qu'on lui pose des questions de clarification avant une tâche complexe.

## Branches et publication

- `brouillon` : branche de travail. Chaque poussée publie l'aperçu apercu.trouvetaclinique.ca.
- `main` : production (trouvetaclinique.ca). On n'y publie **qu'après l'accord explicite** du
  propriétaire (« publie sur main »), en reportant les commits de `brouillon` (cherry-pick), puis
  en régénérant et en vérifiant que le contenu est identique à `brouillon`.
- Un robot régénère les pages après chaque poussée (commits « Régénération des pages du site
  depuis data.json [automatique] ») : toujours `git pull` avant de travailler.

## Ne jamais modifier les pages générées

Les `index.html` des cartes, fiches, RLS, répertoires, guides et le `sitemap.xml` sont produits
par les scripts. Modifier plutôt :

- `data.json` (cliniques, établissements), `guides/donnees.json` (catalogue de guides) ;
- `scripts/sources/*.html` (pages PTEM, PTEM-U, AMP) ;
- `scripts/carte.template.html`, `scripts/carte-est-sq.template.html` (cartes) ;
- `scripts/generer-pages-seo.js`, `scripts/generer-guides-cliniques.cjs`, `scripts/publier-regions.js`.

Puis : `node scripts/generer-pages-seo.js` et, pour les cartes, `node scripts/publier-regions.js`.

## Vérifier avant de pousser

```bash
node --test scripts/test-*.cjs workers/aiguillage/test/logique.test.js
node scripts/verifier-navigation-est.js
node scripts/verifier-fuites-etablissements.js
```

Deux générations de suite doivent produire les mêmes fichiers (`scripts/lastmod.json` garde les
dates du sitemap selon le contenu réel des pages).

## Règles d'écriture

- Aucun tiret cadratin (em dash).
- Pages-guides : une phrase par ligne, avec `<br>` dans les paragraphes narratifs.
- « Nouveau facturant (NF) », jamais l'inverse ; « (PREM-U) » accolé à chaque mention de PTEM-U.
- Contenu PTEM : paraphraser de près les sources officielles (DTMF Montérégie, RAMQ, Québec.ca)
  et citer la source.

## Catalogue de guides (`/guides/`)

- Version française d'abord ; l'anglais seulement à défaut, avec « (EN) » à la fin du titre.
- Seulement ce qui sert à un médecin de famille (pas de documents internes d'établissement).
- Vérifier chaque lien ajouté (réponse directe, bon document, sans redirection vers une page
  générale).
- Champ `cat` = sujet clinique, jamais l'organisme (l'organisme a son propre filtre). Les sujets
  et leur ordre sont dans `ORDRE_SUJETS` (`scripts/generer-guides-cliniques.cjs`) ; un nouveau
  sujet doit y être ajouté (vérifié par `scripts/test-catalogue-guides.cjs`).
- Titres : « Sujet : précision », sans trait d'union collé comme séparateur ; l'ancien titre
  va dans `tags` pour rester trouvable.
- Liens vérifiés chaque lundi par `.github/workflows/verifier-liens-guides.yml`
  (`scripts/verifier-liens-guides.js`), qui ouvre un ticket s'il y a lieu.
- Recherche : `assets/guides-recherche.js` (synonymes `GROUPES`, concepts `CONCEPTS`), testée
  par `scripts/test-recherche-guides.cjs`.
- Aiguillage IA : Worker Cloudflare `workers/aiguillage` (Claude Sonnet 5, crédits prépayés de
  20 $ sans recharge). L'IA suggère des guides du catalogue, elle ne répond jamais à la question
  clinique (décision du propriétaire).

## Divers

- Ce qui est publié est défini par la liste blanche de `scripts/preparer-apercu.js` (dossiers,
  fichiers, extensions, exclusions).
- La PWA et le service worker sont réservés à `/monteregie-est/` ; augmenter la version du cache
  dans `sw.js` quand une ressource mise en cache change.
- Les courriels de recrutement sont publiés volontairement (`PUBLIER_COURRIELS = true`) ; le
  champ `notes` de `data.json` ne doit jamais être public.
