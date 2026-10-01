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

- Deux pages tirées de `guides/donnees.json` par `scripts/generer-guides-cliniques.cjs` :
  `/guides/` (guides, algorithmes, documents pour les patients) et
  `/guides/ressources-communautaires/` (fiches `type: "communautaire"`, sections par rubrique,
  filtres type d'aide et ville, hors territoire masqué par défaut). Onglets en haut des deux
  pages, lien dans le pied de page commun ; recherche, IA (champ `page` envoyé au Worker) et
  favoris partagés. Un lien « N … correspondent aussi » renvoie vers l'autre page.

- Chaque fiche porte `ajoute` (date d'ajout, AAAA-MM-JJ), qui alimente la section « Récemment
  ajoutés » ; l'ajouter à toute nouvelle ressource (vérifié par `scripts/test-catalogue-guides.cjs`).
- Version française d'abord ; l'anglais seulement à défaut, avec « (EN) » à la fin du titre.
- Seulement ce qui sert à un médecin de famille (pas de documents internes d'établissement).
- Sources québécoises et canadiennes seulement ; lien direct vers le guide ou le PDF, jamais une
  page qui liste d'autres documents (demande du propriétaire).
- Vérifier chaque lien ajouté (réponse directe, bon document, sans redirection vers une page
  générale).
- Champ `cat` = sujet clinique, jamais l'organisme (l'organisme a son propre filtre). Les sujets
  et leur ordre sont dans `ORDRE_SUJETS` (`scripts/generer-guides-cliniques.cjs`) ; un nouveau
  sujet doit y être ajouté (vérifié par `scripts/test-catalogue-guides.cjs`).
- Titres : « Sujet : précision », sans trait d'union collé comme séparateur ; l'ancien titre
  va dans `tags` pour rester trouvable.
- Liens vérifiés chaque lundi par `.github/workflows/verifier-liens-guides.yml`
  (`scripts/verifier-liens-guides.js`), qui ouvre un ticket s'il y a lieu.
- Ressources communautaires : fiches `type: "communautaire"` de `guides/donnees.json`, sujet
  « Ressources communautaires » (bottin 2023 du Réseau d'habitations chez soi, bottin des aînés
  2023 de la MRC de Pierre-De Saurel, répertoire Info SVP de la Vallée-du-Richelieu et répertoires
  des CDC : Longueuil, Maskoutains, Vallée-du-Richelieu, Pierre-De Saurel ; « (hors territoire) »
  dans `ville` hors Montérégie-Est ; plus 211, Info-aidant, Info-Social 811 et 9-8-8). Champs propres : `rubrique`,
  `rubriques`, `ville`, `adresse`, `telephone`, `pourQui`, `heures`, `acces`, `services`,
  `sourcePage`. Lien : site de l'organisme vérifié, sinon la page du bottin PDF.
  La recherche fait passer les organismes devant pour une question communautaire
  (`estCommunautaire`), les guides devant pour une question clinique (`rechercherParType`).
- Recherche : `assets/guides-recherche.js` (synonymes `GROUPES`, concepts `CONCEPTS`), testée
  par `scripts/test-recherche-guides.cjs`.
- Aiguillage IA : Worker Cloudflare `workers/aiguillage` (Claude Sonnet 5, crédits prépayés de
  20 $ sans recharge). L'IA reçoit tout le catalogue (une ligne par ressource, mis en cache une
  heure) ; la présélection du moteur de mots-clés n'est qu'un indice. Elle suggère des guides ou
  des organismes du catalogue, elle ne répond jamais à la question clinique (décision du
  propriétaire). Le Worker se déploie depuis `main` (Cloudflare Workers Builds). Plafond de
  150 questions par jour (`PLAFOND_JOUR`), compté dans l'espace KV `COMPTEUR` de `wrangler.toml`.

## Divers

- Ce qui est publié est défini par la liste blanche de `scripts/preparer-apercu.js` (dossiers,
  fichiers, extensions, exclusions), plus les extras de `scripts/preparer-pages-production.js`.
  Depuis le 28 sept. 2026, GitHub Pages est en mode « GitHub Actions » : la production est
  l'artefact du robot « Pages production », sans `scripts/`, ni `.md`, ni `.gs`, ni notes.
- Cartes : fond vectoriel (MapLibre) à l'ordinateur, fond CARTO en images au cellulaire
  (≤ 860 px, choix du propriétaire, 28 sept. 2026). Polices des cartes Montérégie, Centre et
  Ouest hébergées dans `assets/polices/` : aucun service de police externe.
- IndexNow actif : une seule clé `<32 hex>.txt` à la racine (Bing refusait l'ancienne clé).
- DNS de `trouvetaclinique.ca` chez easyDNS (serveurs de noms et MX) : Cloudflare Email
  Routing et les 301 Cloudflare supposent d'abord de déplacer la zone.
- Pages `/a-propos/` et `/confidentialite/` : liens seulement dans le pied de page ; ni le nom
  ni le courriel du propriétaire dans leur texte (demande du propriétaire). Formulaire
  « Nous joindre » : Worker `/contact`, repli sur un courriel prérempli tant que l'envoi direct
  n'est pas configuré.
- Adresse publique du site : `contact@trouvetaclinique.ca` (transfert easyDNS vers la boîte du
  propriétaire, 29 sept. 2026), pour tous les courriels préremplis (signaler, mettre à jour,
  proposer un guide, repli du formulaire). Ne plus afficher l'adresse du CISSS.
- Deux PWA indépendantes : `/monteregie-est/` (`sw.js` à la racine) et l'app « Guides »
  (`guides/sw.js`, portée `/guides/`, `guides/manifest.webmanifest`). Augmenter la version du
  cache (`CACHE`) du service worker concerné quand une ressource mise en cache change.
- Les courriels de recrutement sont publiés volontairement (`PUBLIER_COURRIELS = true`).
- Vidéo promotionnelle : page `/monteregie-est/video/` (générée par `pageVideoEst()`, indexée, dans le sitemap
  et la recherche du site, données structurées VideoObject) ; le fichier `monteregie-est/video/trouve-ta-clinique-monteregie-est.mp4` et son `affiche.jpg`
  sont déposés à la main. Pour remplacer la vidéo : écraser le fichier (moins de 50 Mo, `-movflags +faststart`)
  et changer `VERSION_VIDEO`. La musique (Mixkit) ne doit jamais être publiée seule.
- Crédits de la carte Est : `CREDITS_BLOC` (`scripts/carte-est-sq.template.html`), **`false`**
  (bande « © OpenStreetMap © CartoDB | © Olivier Laplante »). Le 1er oct. 2026, la collaboratrice
  a demandé le retrait de son nom du projet (carte, site, vidéo) : ne plus le publier nulle part.
  `CREDITS_COLLAB` = `false` (encadré « Réalisé en collaboration avec » retiré) et `LEGENDE_RLS`
  = `true` (légende des 3 RLS rétablie). Le bloc `CREDITS_BLOC` ne nomme plus que le
  propriétaire. Après tout changement : `node scripts/publier-regions.js`.

## Notes internes des cliniques (garde-fou du 26 septembre 2026)

Le dépôt et `data.json` sont publics : le champ `notes` des cliniques doit rester **vide**.
Les notes de travail restent dans le classeur Google Sheets (colonne « [carte] notes »).

- `data.json` est exporté du classeur par `PTEM2027_v2.gs` (Apps Script), qui écrit maintenant
  toujours `notes: ''`. **La copie de ce script dans le classeur doit être la version du dépôt** :
  une ancienne copie remettrait les notes dans l'export.
- Deux garde-fous refusent toute note non vide : le test `scripts/test-pages-production.cjs` et
  l'étape « Vérifier qu'aucune donnée privée n'a fui » du robot `.github/workflows/generer-pages-seo.yml`
  (message « Notes internes dans data.json : … »).
- Si le robot échoue avec ce message après un export : **ne pas retirer le garde-fou**. Vider les
  `notes` des cliniques nommées dans `data.json` (`"notes": ""`), pousser, puis coller la version
  à jour de `PTEM2027_v2.gs` dans l'éditeur Apps Script du classeur pour que l'export suivant
  soit propre.
