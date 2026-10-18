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
- `scripts/carte-est-sq.template.html` (cartes Est et Montérégie), `scripts/generer-carte-sq-complete.js`
  (transformations de la carte Montérégie), `scripts/carte.template.html` (en-tête de la carte Est) ;
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
  par `scripts/test-recherche-guides.cjs`. Requête surprise (16 oct. 2026, demande du propriétaire, avec
  l'accord de la personne) : un mot-clé reconnu seulement par son empreinte (`SURPRISE`) affiche la
  balanoposthite puis les guides ITSS. Ne jamais écrire ce mot-clé en clair dans le dépôt.
- Aiguillage IA : Worker Cloudflare `workers/aiguillage` (Claude Sonnet 5.5 depuis le 1er oct. 2026, repli automatique côté serveur, crédits prépayés de
  20 $ sans recharge). L'IA reçoit le catalogue (une ligne par ressource, mis en cache cinq
  minutes depuis le 17 oct. 2026 : le cache d'une heure coûtait le double à l'écriture) ; pour une question
  clinique de la page des guides (la page envoie `communautaire: false`), sans les organismes communautaires
  sauf les lignes d'urgence et d'écoute (`catalogueSelonPage`, environ 30 % de jetons en moins). Coût estimé
  d'une question isolée : environ 12 ¢ (README du Worker). La présélection du moteur de mots-clés n'est qu'un indice. Elle suggère des guides ou
  des organismes du catalogue, elle ne répond jamais à la question clinique (décision du
  propriétaire). Aucun texte rédigé par l'IA n'est affiché (3 oct. 2026) : seulement les fiches
  choisies, leur type et une phrase fixe si un aspect n'est couvert par aucune fiche (`lacune`). Le Worker se déploie depuis `main` (Cloudflare Workers Builds). Plafond de
  150 questions par jour (`PLAFOND_JOUR`), compté dans l'espace KV `COMPTEUR` de `wrangler.toml`.
  Une nouvelle recherche par mots-clés, « Tout afficher » ou la question effacée retirent les suggestions
  de l'IA, et une réponse encore attendue est abandonnée (`effacerSuggestions`, `assets/guides-aiguillage.js`).

## Divers

- Cartes (3 oct. 2026) : deux cartes seulement. `/monteregie-est/` en avant-plan, et `/monteregie/`,
  carte Santé Québec de toute la Montérégie (indexée, filtre `?region=Centre|Ouest`). Les fiches,
  RLS et répertoires du Centre et de l'Ouest y renvoient. `/monteregie-centre/` et `/monteregie-ouest/`
  sont des pages texte de territoire (`pageTerritoire()`), plus des cartes. `/carte-interactive/`
  renvoie vers `/monteregie/`.

- Ce qui est publié est défini par la liste blanche de `scripts/preparer-apercu.js` (dossiers,
  fichiers, extensions, exclusions), plus les extras de `scripts/preparer-pages-production.js`.
  Depuis le 28 sept. 2026, GitHub Pages est en mode « GitHub Actions » : la production est
  l'artefact du robot « Pages production », sans `scripts/`, ni `.md`, ni `.gs`, ni notes.
- Cartes : fond vectoriel (MapLibre) à l'ordinateur, fond CARTO en images au cellulaire
  (≤ 860 px, choix du propriétaire, 28 sept. 2026). Polices des cartes Montérégie, Centre et
  Ouest hébergées dans `assets/polices/` : aucun service de police externe.
- Cartes et répertoire écrit (11 oct. 2026, choix du propriétaire) : effet aimant. Un petit défilement
  ramène la page sur la carte ; au-delà de 60 % de l'écran, elle va au début du répertoire, qui défile
  ensuite librement. Aimantation CSS (`scroll-snap`, proximité) et script `repertoire-aimant`, ajoutés
  par `publier-regions.js` avec le répertoire. Le répertoire reste visible et dans le HTML (rien de masqué,
  pour Google).
- Carte Est hermétique (13 oct. 2026, choix du propriétaire) : `/monteregie-est/` ne mène à aucune autre
  page du site. Menu « i » : seulement la page de recrutement du CISSS (plus l'installation de l'app) ;
  fiches GMF-U sans lien vers le guide PTEM-U ; répertoire sous la carte en texte sans liens
  (`hermetique: true` dans `publier-regions.js`, `<section>` au lieu de `<nav>`). Restent les liens
  externes (sites des cliniques, Google Maps, portes ouvertes), les courriels et les téléphones. La carte
  `/monteregie/` garde ses liens (`generer-carte-sq-complete.js` les remet). Garde-fou : `liensVersLeSite`
  (`scripts/verifier-navigation-est.js`, page et champs des données qui deviennent des liens) bloque la
  génération et la publication ; un nouveau lien calculé (`href="${…}"`) doit être vérifié, puis ajouté à
  `LIENS_CALCULES_EXTERNES`.
- Version autonome de la carte Est (14 oct. 2026, demande du propriétaire, pour le site du recrutement de
  Santé Québec Montérégie-Est) : page non répertoriée `/carte-recrutement-est/` (noindex, hors plan du site,
  aucune page du site n'y renvoie, hermétique : `PAGES_HERMETIQUES` de `verifier-navigation-est.js`, tests de
  `test-navigation-est.cjs`). Bannière actuelle avec « RECRUTEMENT MÉDICAL » au lieu du nom du site, sans
  commentaires internes, sans PWA ni mesure d'audience, fond de carte OpenFreeMap sans clé (la clé CARTO du
  site n'y figure pas ; crédits « © OpenMapTiles © OpenStreetMap | © Olivier Laplante », OpenFreeMap n'exigeant pas
  sa propre mention). Elle lit `../data.json` et `../data-etablissements.json` : ses données suivent celles
  du site. Page statique produite par l'outil de version autonome, gardé hors du dépôt avec le zip remis au
  CISSS : la reproduire après un changement du gabarit Est. Le nom du propriétaire figure dans ses crédits
  (c'est une carte, `test-pages-info.cjs`). Audit final du zip (15 oct. 2026) : le serveur du CISSS (Drupal 10
  derrière Cloudflare) garde les fichiers statiques un an, donc le zip charge `reglages.js` et `donnees/*.js` avec
  un numéro qui change toutes les 5 minutes ; données du zip sans les champs non affichés (`infos`,
  `statutRecrutement`, `evenement`, `horaireSource`, `posApprox`) ; vérificateur qui donne la ligne d'une erreur
  (fichier glissé dans la page, Chrome cachant le détail des erreurs en local) et repère un fichier non UTF-8 ;
  mode d'emploi en deux parties (service informatique, mise à jour sans connaissances techniques).
- IndexNow actif : une seule clé `<32 hex>.txt` à la racine (Bing refusait l'ancienne clé).
- DNS de `trouvetaclinique.ca` chez easyDNS (serveurs de noms et MX) : Cloudflare Email
  Routing et les 301 Cloudflare supposent d'abord de déplacer la zone.
- Pages `/a-propos/` et `/confidentialite/` : liens seulement dans le pied de page ; ni le nom
  ni le courriel du propriétaire dans leur texte (demande du propriétaire). Depuis le 14 oct. 2026, plus de
  mention d'une collaboration avec le recrutement médical de la Montérégie-Est, et le site se dit
  « indépendant du gouvernement du Québec, de Santé Québec et des DTMF » (accueil, À propos, guides). Formulaire
  « Nous joindre » : Worker `/contact`, repli sur un courriel prérempli tant que l'envoi direct
  n'est pas configuré.
- Adresse publique du site : `contact@trouvetaclinique.ca` (transfert easyDNS vers la boîte du
  propriétaire, 29 sept. 2026), pour tous les courriels préremplis (signaler, mettre à jour,
  proposer un guide, repli du formulaire). Ne plus afficher l'adresse du CISSS.
- Deux PWA indépendantes : `/monteregie-est/` (`sw.js` à la racine) et l'app « Guides »
  (`guides/sw.js`, portée `/guides/`, `guides/manifest.webmanifest`). Augmenter la version du
  cache (`CACHE`) du service worker concerné quand une ressource mise en cache change.
- Courriels retirés du site le 8 oct. 2026, « jusqu'à nouvel ordre » (une médecin a demandé le retrait
  de son courriel personnel) : `scripts/masquer-courriels.js` (`PUBLIER_COURRIELS = false`) remplace
  chaque adresse par « À venir » à la génération des pages et dans les JSON publiés (`donneesPubliques`),
  même si l'export du classeur en remet dans `data.json`. Exceptions : `contact@trouvetaclinique.ca` et,
  depuis le 10 oct. 2026, les adresses génériques de recrutement des CISSS : `recrutement.md.cisssme16@…`
  sur toutes les fiches de cliniques et d'établissements de l'Est du site (`COURRIEL_RECRUTEMENT_EST`,
  `generer-pages-seo.js`, hors données : la carte n'est pas touchée) et sur la page PTEM, avec
  `recrutement_omnis.cisssmo16@…` (Ouest). Deux interrupteurs dans `masquer-courriels.js` :
  `PUBLIER_COURRIELS_SITE` (pages) et `PUBLIER_COURRIELS_CARTE` (JSON publiés et pages des cartes).
  Vérifié par `scripts/test-courriels-masques.cjs` (aucun autre courriel dans les fichiers publiés,
  catalogue de guides compris ; les tests suivent les interrupteurs). Le classeur et son export (`PTEM2027_v2.gs`, v5 : courriels et numéros
  masqués) ne servent plus depuis le 10 oct. 2026 (voir « Notes internes des cliniques »).
  Ne rien republier sans l'accord explicite du propriétaire.
- Courriels sur les cartes (13 oct. 2026, accord du propriétaire) : réaffichés pour les cliniques de l'Est
  seulement (`REGIONS_COURRIELS_CARTE = ['Est']` dans `masquer-courriels.js`, appliqué par
  `masquerPourCarte`). Depuis le 14 oct. 2026 (choix du propriétaire, après le courriel du recrutement médical
  de Santé Québec Montérégie-Est), seule la carte de l'Est les affiche : la carte `/monteregie/` remplace, au
  chargement, les contacts des cliniques et des secteurs de l'Est par l'adresse générale du recrutement
  (`courrielsGenerauxEst`, `generer-carte-sq-complete.js`). Les 26 adresses d'avant le 8 oct. ont été remises avec
  `node scripts/restaurer-courriels.js --region=Est --appliquer`. Centre et Ouest : « À venir » (en attente).
  Pour eux un jour : ajouter la région à `REGIONS_COURRIELS_CARTE`, puis `restaurer-courriels.js --region=…
  --appliquer` (SEC-C-010 et toute fiche `contactMasque` restent masqués). Les fiches du site gardent
  l'adresse du CISSS (`PUBLIER_COURRIELS_SITE = false`). Courriels reçus par le formulaire : dans `data.json`
  (dépôt public) seulement sur demande du propriétaire, et jamais pour le Centre ou l'Ouest d'ici leur accord.
  Vérifié par `scripts/test-courriels-masques.cjs`. Établissements de l'Est : leurs courriels ne sont plus dans
  les données depuis le 2 sept. (décision antérieure, `afficherResponsableCourriel: false`). Le 14 oct. 2026,
  le recrutement médical de Santé Québec Montérégie-Est a transmis la liste des courriels des départements et
  demandé leur ajout sur la carte ; le propriétaire a accepté explicitement (carte de l'Est seulement, adresse
  générale pour les secteurs absents de la liste). Fait le 14 oct. : `responsableCourriel` des 31 secteurs de
  `data-etablissements.json` (politique `afficherResponsableCourriel: true`), exception
  `REGIONS_COURRIELS_SECTEURS_CARTE` de `masquer-courriels.js`, garde-fou `verifier-fuites-etablissements.js`
  (`contexteAutoriseEst`) qui permet ces adresses dans `data-etablissements.json` seulement et les interdit
  toujours dans les pages du site. Sur la carte, le contact d'un secteur montre le nom et l'adresse.
- Audit des données sensibles (9 oct. 2026, décisions du propriétaire) : numéros de téléphone des textes
  libres remplacés par « À venir » sauf la ligne principale d'une clinique (« Téléphone : … »), dans le
  même filtre (`PUBLIER_TELEPHONES = false`) ; JSON publiés sans fiches masquées (`visible: false`), sans
  « infos » des fiches HRR du Centre (jamais affichées), sans sources internes (`sourceRepertoire`,
  `meta.sourceDocument`, notes de `politiqueAffichage`) : `donneesPubliques` de `preparer-apercu.js`.
  Les noms des responsables du recrutement restent publiés (choix du propriétaire).
- Contacts retirés à la demande de la personne (9 oct. 2026) : `contactMasque: true` dans l'objet qui
  porte le nom (pour le Centre : `recrutement` du secteur). Nom vidé dans les données, filtre commun de
  `masquer-courriels.js` (nom, courriel, téléphone retirés de tout ce qui est publié), aucune ligne
  « Contact » sur la fiche ni sur les cartes. Secteur concerné : SEC-C-010. Ne jamais remettre ce nom ni
  l'écrire ailleurs dans le dépôt (tests et notes : identifiant seulement).
- Vidéo promotionnelle : page `/monteregie-est/video/` (générée par `pageVideoEst()`, indexée, dans le sitemap
  et la recherche du site, données structurées VideoObject) ; le fichier `monteregie-est/video/trouve-ta-clinique-monteregie-est.mp4` et son `affiche.jpg`
  sont déposés à la main. Pour remplacer la vidéo : écraser le fichier (moins de 50 Mo, `-movflags +faststart`)
  et changer `VERSION_VIDEO`. La musique (Mixkit) ne doit jamais être publiée seule.
- Crédits de la carte Est : `CREDITS_BLOC` (`scripts/carte-est-sq.template.html`), **`false`**
  (bande « © OpenStreetMap © CartoDB | © Olivier Laplante », sans le préfixe « Leaflet » depuis le 15 oct. 2026 pour
  tenir sur une ligne au cellulaire : `setPrefix(false)`, même gabarit pour `/monteregie/` ; le nom n'est plus masqué
  qu'au-dessous de 320 px, au lieu de 380 px). Noms de lieux du fond vectoriel en français (`nomsEnFrancais`, nom
  français sinon local, 15 oct. 2026). Le 1er oct. 2026, la collaboratrice
  a demandé le retrait de son nom du projet (carte, site, vidéo) : ne plus le publier nulle part.
  `CREDITS_COLLAB` = `false` (encadré « Réalisé en collaboration avec » retiré) et `LEGENDE_RLS`
  = `true` (légende des 3 RLS rétablie). Le 8 oct. 2026, le propriétaire a demandé que son nom reste sur les
  cartes seulement (bande ci-dessus et bloc `CREDITS_BLOC`) et disparaisse du reste du site : pied de
  page « © année · Trouve ta clinique » (`generer-pages-seo.js`, `scripts/sources/*.html`), `LICENSE`
  gardé dans le dépôt mais plus publié, données structurées de l'accueil sans fondateur nommé
  (vérifié par `scripts/test-pages-info.cjs`). Après tout changement : `node scripts/publier-regions.js`.

## Notes internes des cliniques (garde-fou du 26 septembre 2026)

Le dépôt et `data.json` sont publics : le champ `notes` des cliniques doit rester **vide**.
Les notes de travail restent dans le classeur Google Sheets (colonne « [carte] notes »).

**Depuis le 10 oct. 2026, le classeur et son export automatique ne servent plus** (décision du
propriétaire) : `data.json` se met à jour à la main, avec Claude, à partir des réponses au formulaire.
Les modifications faites directement dans `data.json` ne seront donc plus écrasées par un export. Le
script `PTEM2027_v2.gs` reste dans le dépôt au cas où on le reprendrait ; ce qui suit ne vaut alors
que pour lui. Les garde-fous restent actifs.

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
