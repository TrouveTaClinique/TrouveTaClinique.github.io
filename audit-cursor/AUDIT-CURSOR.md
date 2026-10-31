# Méga audit de Trouve ta clinique avec Cursor

Document unique : mode d'emploi, règles communes, pages de référence et 19 missions.
Cursor observe, mesure et écrit des rapports ; il ne modifie rien au projet (audit seulement,
choix du propriétaire). Les rapports sont ensuite transmis à Claude, qui applique les corrections
que le propriétaire valide.

## Mode d'emploi (pour le propriétaire)

### Avant de commencer (10 minutes)

1. Ouvre le dossier du projet dans Cursor. S'il n'est pas encore sur ton ordinateur : dans
   Cursor, « Clone repository », adresse
   `https://github.com/TrouveTaClinique/TrouveTaClinique.github.io`.
2. Dans le terminal de Cursor, tape une ligne à la fois :

   ```
   node --version
   git fetch
   git checkout brouillon
   git pull
   node audit-cursor/outils/etat-initial.mjs
   ```

   Il faut Node.js 20 ou plus. La branche `brouillon` contient ce document
   (`audit-cursor/AUDIT-CURSOR.md`) et les deux outils de l'audit. La dernière ligne lance les
   tests du projet et écrit `audit-cursor/rapports/00-etat-initial.md`.
3. Choisis le modèle le plus puissant offert par Cursor, en mode Agent, et active le mode Max
   s'il est proposé.

### Lancer une mission

Ouvre une **nouvelle conversation** en mode Agent pour chaque mission et colle ce texte, en
changeant le numéro :

```
Lis audit-cursor/AUDIT-CURSOR.md, en particulier les sections « Règles communes » et « Pages de référence », puis exécute la mission 01.
```

- Tu peux aussi glisser ce document dans la conversation au lieu de donner son chemin.
- Avec un très grand contexte (mode Max), tu peux enchaîner deux ou trois missions courtes dans
  une même conversation : « … puis exécute les missions 09 et 10, l'une après l'autre, en
  terminant chaque rapport avant de passer à la suivante. » Garde seules les missions longues
  (07, 08 et 14).
- Quand Cursor demande d'approuver une commande : accepte `node`, `npx`, `git log`, `git grep`,
  `git show`, `git worktree` ; **refuse** `git commit`, `git push`, `git reset`, `git clean`,
  `git checkout` d'une autre branche, `npm install` dans le dossier du projet, et toute
  modification d'un fichier hors de `audit-cursor/rapports/`.
- Si une conversation devient trop longue, ouvre-en une nouvelle : « Lis
  audit-cursor/AUDIT-CURSOR.md, puis continue la mission 07 à partir de la section Suite à faire
  de son rapport. »
- Laisse l'ordinateur allumé pendant les missions longues.

### Les missions

| N° | Mission |
|---|---|
| 01 | État initial et carte du projet |
| 02 | Ce qui est publié et confidentialité |
| 03 | Historique git public |
| 04 | Sécurité technique |
| 05 | Contenu des guides PTEM, PTEM-U (PREM-U) et AMP |
| 06 | Données des cliniques et des établissements |
| 07 | Catalogue de guides cliniques |
| 08 | Ressources communautaires |
| 09 | Moteur de recherche des guides |
| 10 | Aiguillage par IA (sans aucun appel payant) |
| 11 | Accessibilité (WCAG 2.2, niveau AA) |
| 12 | Téléphone, applications installables et hors ligne |
| 13 | Performance |
| 14 | Référencement, données structurées et liens internes |
| 15 | Cartes |
| 16 | Code, scripts de génération et tests |
| 17 | Rédaction, français et cohérence |
| 18 | Idées d'amélioration (facultative) |
| 19 | Synthèse (à faire en dernier) |

Ordre conseillé si le temps manque : 01, puis 02, 03, 05, 07, 06, 15, 11, 04, 14, 08, 12, 09, 10,
13, 16, 17, 18, et toujours 19 en dernier. Les missions 02 à 18 sont indépendantes : si Cursor
permet plusieurs agents en même temps, lances-en plusieurs à la fois.

### À la fin

1. La mission 19 produit `audit-cursor/rapports/AUDIT-COMPLET.md` (ou lance
   `node audit-cursor/outils/assembler-rapports.mjs`). Ce script signale toute donnée
   personnelle oubliée dans un rapport : fais-la retirer par Cursor avant l'envoi.
2. Tape `git status` : aucun fichier modifié ne doit apparaître.
3. Envoie `AUDIT-COMPLET.md` à Claude, en glissant le fichier dans la conversation.

### Sécurité

- Les rapports restent sur ton ordinateur : git ignore `audit-cursor/rapports/`, qui n'est donc
  jamais envoyé sur GitHub (le dépôt est public).
- Aucune mission n'envoie de formulaire ni ne pose de question à l'IA du site : l'audit ne coûte
  rien sur ton compte Anthropic.
- Ce dossier n'est pas publié sur le site.

## Règles communes (à lire avant chaque mission)

Tu es un auditeur. Ce document découpe un audit complet du projet Trouve ta clinique (trouvetaclinique.ca) en 19
missions (section « Missions »). Le propriétaire a choisi un
**audit seulement** : tu observes, tu mesures, tu proposes. Tu ne corriges rien.

Avant toute chose, lis `CLAUDE.md` à la racine : il décrit le projet, ses règles et ses garde-fous.

### 1. Ne rien modifier

- Aucun fichier suivi par git ne doit être modifié, créé, renommé ou supprimé. Tu écris
  seulement dans `audit-cursor/rapports/`, que git ignore.
- Pas de `git commit`, `git push`, `git stash`, `git reset`, `git checkout <branche>`, `git clean`,
  `git rebase`, pas de demande de fusion, pas de ticket GitHub.
  Attention : `git clean` effacerait des fichiers privés que le propriétaire garde hors du dépôt
  (`*.prive.json`, `scripts/donnees-etablissements-source.json`, `PROJECT_MEMORY.md`).
- Pour une vérification qui écrit des fichiers (génération des pages, préparation de la version
  publiée), travaille dans une copie temporaire hors du dépôt :
  - copie de travail : `git worktree add ../ttc-audit-NN HEAD` (NN = numéro de la mission),
    puis `git worktree remove --force ../ttc-audit-NN` à la fin ;
  - version publiée : `node scripts/preparer-pages-production.js <dossier temporaire>`.
- Scripts du projet permis : les tests (`node --test scripts/test-*.cjs`, tests de
  `workers/aiguillage/test/`), `scripts/verifier-*.js`, `scripts/preparer-pages-production.js`
  vers un dossier temporaire, `scripts/generer-pages-seo.js` et `scripts/publier-regions.js`
  dans une copie temporaire seulement. **Ne lance aucun autre script du dossier `scripts/`** :
  certains publient, déposent ou modifient les données (`deployer-*`, `deposer-*`,
  `soumettre-indexnow.js`, `restaurer-courriels.js`, `mettre-a-jour-date-donnees.js`,
  `projeter-etablissements.js`, `construire-data-etablissements.js`, `preparer-apercu.js`,
  scripts de logo et d'icônes).
- Pas de `npm install` dans le dépôt. Les outils temporaires (Playwright, axe-core, Lighthouse)
  s'installent dans un dossier hors du dépôt, par exemple `%TEMP%\ttc-audit-outils`, ou passent
  par `npx --yes`. Seule exception : `npm ci` dans `workers/aiguillage` (son `node_modules` est
  ignoré par git et `npm ci` ne touche pas au fichier de verrouillage).
- Tes scripts temporaires vont dans `audit-cursor/rapports/outils-temp/`, tes captures d'écran
  dans `audit-cursor/rapports/captures/`, les sorties brutes volumineuses dans
  `audit-cursor/rapports/bruts/`.
- À la fin de chaque mission, `git status --porcelain` doit être vide. Sinon, signale-le dans le
  rapport et restaure seulement le fichier que tu as modifié par erreur (`git restore <fichier>`).

### 2. Ne rien divulguer

Le dépôt GitHub est public, et tes rapports seront transmis à d'autres personnes.

- N'écris dans un rapport aucun courriel, numéro de téléphone, nom de personne, clé, jeton ou mot
  de passe, même s'il est déjà publié. Désigne la donnée par son type et son emplacement :
  « courriel personnel, `data.json`, fiche CLI-123, champ `infos` », « clé d'API, commit abc1234 ».
- Ne copie jamais le contenu des fichiers privés du propriétaire dans un rapport.
- La recherche des guides contient une « requête surprise » reconnue par une empreinte
  (`SURPRISE`, `assets/guides-recherche.js`). N'essaie pas de retrouver ce mot-clé et ne l'écris
  nulle part.
- N'envoie aucun fichier du projet vers un service en ligne (validateur, outil d'IA externe,
  site de partage). Les validateurs qui lisent une adresse publique (par exemple
  https://validator.schema.org/ sur une page du site en ligne) sont permis.

### 3. Réseau : lire seulement, poliment

- Permis : lire les pages publiques (site en ligne https://trouvetaclinique.ca, aperçu
  https://apercu.trouvetaclinique.ca, sources officielles, liens du catalogue).
- Pas plus d'une requête par seconde vers un même domaine (sauf `scripts/verifier-liens-guides.js`,
  déjà réglé), avec un délai d'attente raisonnable.
- **Interdit** : envoyer un formulaire (le formulaire « Nous joindre » envoie un vrai courriel),
  poser une question à la boîte « Demander à l'IA » ou appeler le service d'IA (chaque question
  coûte de l'argent au propriétaire), se connecter à un compte, soumettre une adresse à un moteur
  de recherche.

### 4. Exactitude

- Aucune affirmation tirée de ta mémoire sur une règle administrative ou médicale : cite la
  source consultée (adresse et date). Si tu n'as pas pu vérifier, écris « à vérifier ».
- Distingue ce que tu as mesuré (commande lancée, page ouverte) de ce que tu déduis.
- Respecte les règles du projet (`CLAUDE.md`) dans tes propositions : ne propose pas de retirer
  un garde-fou, de republier des courriels masqués, d'ajouter des tirets cadratins, de modifier
  directement une page générée (propose plutôt le changement dans la source : données, gabarit
  ou script). Si une règle te semble elle-même poser problème, mets-la dans « Questions pour le
  propriétaire ».
- Le site est en français du Québec : rapports en français, sans tiret cadratin.

### 5. Environnement

- Le propriétaire travaille sous Windows : commandes compatibles avec PowerShell, chemins sans
  syntaxe propre à bash. Pour tout traitement non trivial, écris un petit script Node dans
  `audit-cursor/rapports/outils-temp/`.
- Node.js 20 ou plus est requis. Sous Windows, si `node --test scripts/test-*.cjs` ne trouve pas
  les fichiers (motif non reconnu), `node audit-cursor/outils/etat-initial.mjs` lance les mêmes tests.

### 6. Format du rapport

Un rapport par mission : `audit-cursor/rapports/NN-nom.md` (nom donné dans la mission).

```markdown
# Mission NN : titre

- Date : AAAA-MM-JJ
- Commit audité : (résultat de `git rev-parse --short HEAD`)
- Modèle utilisé : (nom du modèle de Cursor)

## Résumé
Cinq lignes au plus : l'essentiel, dans l'ordre d'importance.

## Constats
| ID | Gravité | Où | Constat | Preuve | Correction proposée | Confiance |
|---|---|---|---|---|---|---|
| NN-01 | Élevée | `fichier:ligne` ou adresse de la page | ... | commande lancée ou court extrait, sans donnée personnelle | changement précis, dans la source | Élevée |

## Vérifié sans problème
Ce qui a été contrôlé et qui est correct (pour éviter de le refaire).

## Limites
Ce qui n'a pas pu être vérifié, et pourquoi.

## Questions pour le propriétaire
Décisions qui lui reviennent.
```

- Gravité : **Critique** (fuite de données, faille, site ou carte en panne), **Élevée** (erreur de
  contenu qui peut tromper un médecin, fonction importante brisée), **Moyenne**, **Faible**,
  **Info**.
- Confiance : Élevée (mesuré), Moyenne (déduit), Faible (à confirmer).
- Une ligne par problème ; regroupe les cas identiques (« 14 liens, liste dans
  `rapports/bruts/...` »).
- Si la mission est trop longue pour une seule conversation : écris le rapport partiel avec une
  section « Suite à faire » et arrête-toi. Le propriétaire relancera avec « continue la mission NN ».

## Pages de référence

Pages types à tester dans les missions qui ouvrent le site. Le plan complet est dans
https://trouvetaclinique.ca/sitemap.xml (environ 120 adresses indexées).

| Type | Adresse |
|---|---|
| Accueil | https://trouvetaclinique.ca/ |
| Carte de la Montérégie-Est (application, hermétique) | https://trouvetaclinique.ca/monteregie-est/ |
| Carte de toute la Montérégie | https://trouvetaclinique.ca/monteregie/ (aussi `?region=Centre` et `?region=Ouest`) |
| Version autonome de la carte de l'Est (non répertoriée, noindex) | https://trouvetaclinique.ca/carte-recrutement-est/ |
| Fiche de clinique (Est) | https://trouvetaclinique.ca/monteregie-est/cliniques/gmf-des-iles-percees/ |
| Fiche de clinique (Centre) | https://trouvetaclinique.ca/monteregie-centre/cliniques/gmf-lapiniere/ |
| Page de RLS | https://trouvetaclinique.ca/monteregie-est/rls/richelieu-yamaska/ |
| Page de territoire (texte) | https://trouvetaclinique.ca/monteregie-centre/ et https://trouvetaclinique.ca/monteregie-ouest/ |
| Guide PTEM | https://trouvetaclinique.ca/monteregie-est/ptem/ |
| Guide PTEM-U (PREM-U) | https://trouvetaclinique.ca/monteregie-est/ptem-u/ |
| Guide AMP | https://trouvetaclinique.ca/monteregie-est/amp/ |
| Vidéo | https://trouvetaclinique.ca/monteregie-est/video/ |
| Recherche du site | https://trouvetaclinique.ca/recherche/ |
| Catalogue de guides cliniques | https://trouvetaclinique.ca/guides/ |
| Ressources communautaires | https://trouvetaclinique.ca/guides/ressources-communautaires/ |
| À propos (formulaire « Nous joindre » : ne jamais l'envoyer) | https://trouvetaclinique.ca/a-propos/ |
| Confidentialité | https://trouvetaclinique.ca/confidentialite/ |
| Page introuvable | https://trouvetaclinique.ca/page-inexistante-audit/ |
| Aperçu (branche brouillon) | https://apercu.trouvetaclinique.ca/ |

Sur les pages des guides, ne jamais envoyer de question dans la boîte « Demander à l'IA ».

## Missions

### Mission 01 : état initial et carte du projet

Rapport : `audit-cursor/rapports/01-carte-du-projet.md`. À faire en premier.

#### But
Établir l'état de départ et une carte fiable du projet, qui servira aux autres missions.

#### Étapes
1. Lance `node audit-cursor/outils/etat-initial.mjs` : il écrit `rapports/00-etat-initial.md`
   (commit, tests, vérifications). Résume son résultat ; tout échec est un constat.
2. Lis `CLAUDE.md`, `README.md`, `CHANGELOG.md`, `LISEZ-MOI.txt`, `docs/`,
   `scripts/NOTES-REDIRECTIONS-SEO.md`, `scripts/RECONCILIATION-MAITRE.md`,
   `workers/aiguillage/README.md` et les quatre robots de `.github/workflows/`.
3. Pour chaque type de page publiée (voir la section « Pages de référence » et la liste blanche de
   `scripts/preparer-apercu.js`) : source des données, gabarit, script qui la produit, tests qui
   la couvrent. Présente-le en tableau.
4. Décris le chemin d'une modification, de `brouillon` jusqu'à la production (robots,
   régénération, aperçu, Pages production, service d'IA chez Cloudflare).
5. Compare `CLAUDE.md` au code réel : chaque interrupteur ou réglage cité (`PUBLIER_COURRIELS_*`,
   `REGIONS_COURRIELS_CARTE`, `CREDITS_BLOC`, `CREDITS_COLLAB`, `LEGENDE_RLS`,
   `PLAFOND_JOUR`, `MODELE`, versions de cache, etc.) existe-t-il avec la valeur décrite ?
   Relève les passages périmés ou contradictoires.
6. Repère les fichiers ou dossiers qui semblent inutiles ou orphelins (racine, `assets/`,
   `scripts/`, `vendor/`) : ni publiés, ni lus par un script, ni cités. Ne propose pas de les
   supprimer sans dire ce qui pourrait en dépendre.

#### À rendre
Le rapport habituel, plus : le tableau « page publiée → source → script → tests », le schéma du
chemin de publication (texte), et la liste des écarts entre `CLAUDE.md` et le code.

### Mission 02 : ce qui est publié et confidentialité

Rapport : `audit-cursor/rapports/02-publication-et-confidentialite.md`.

#### But
Vérifier, fichier par fichier, que la version publiée ne contient aucune donnée qui ne devrait
pas l'être, et que les garde-fous l'empêcheraient vraiment.

#### Étapes
1. Produis la version publiée dans un dossier temporaire hors du dépôt :
   `node scripts/preparer-pages-production.js <dossier temporaire>`.
   Inventaire : nombre de fichiers, taille totale, dix plus gros fichiers, extensions.
2. Contrôle qu'il n'y a ni `.md`, ni script de `scripts/`, ni fichier privé (`*.prive.json`,
   source des établissements), ni `LICENSE`, ni note interne.
3. Dans tous les fichiers texte publiés (HTML, JS, JSON, CSS, manifestes), cherche :
   - les adresses courriel : classe chacune selon les règles de `CLAUDE.md`
     (`contact@trouvetaclinique.ca`, adresses génériques de recrutement des CISSS, courriels des
     cliniques de l'Est dans les données des cartes seulement, courriels des départements dans
     `data-etablissements.json` seulement) ; toute autre est un constat ;
   - les numéros de téléphone dans les textes libres (règle `PUBLIER_TELEPHONES`) ;
   - les champs qui ne doivent pas être publiés : `notes` non vides, `sourceRepertoire`,
     `meta.sourceDocument`, notes de `politiqueAffichage`, `infos` des fiches HRR du Centre,
     fiches `visible: false`, noms des fiches `contactMasque` ;
   - les commentaires internes dans le HTML et le JS publiés (notes de travail, décisions,
     noms de personnes, mentions de documents internes) ;
   - le nom du propriétaire : permis seulement sur les cartes (voir `CLAUDE.md`, crédits).
4. Vérifie la même chose sur le site en ligne pour un échantillon (accueil, deux fiches, les
   deux cartes, `data.json`, `data-etablissements.json`, `guides/donnees.json`) : le fichier en
   ligne doit être identique à celui que produit l'étape 1.
5. Essais des garde-fous, dans une copie temporaire (`git worktree add ../ttc-audit-02 HEAD`) :
   introduis une à une des fuites fictives (courriel inventé `exemple.fictif@exemple.org` dans un
   champ libre de `data.json`, note non vide, téléphone dans un texte libre, courriel dans
   `guides/donnees.json`), lance les tests et les vérifications, et note lesquels détectent la
   fuite. Supprime la copie à la fin.

#### Rappel
Aucune donnée réelle dans le rapport : type de donnée et emplacement seulement.

### Mission 03 : historique git public

Rapport : `audit-cursor/rapports/03-historique-git.md`.

#### But
Le dépôt est public : une donnée retirée du site peut rester lisible dans l'historique.
Recenser ce qui y reste, sans jamais le recopier.

#### Étapes
1. Écris un script Node dans `rapports/outils-temp/` qui parcourt tous les commits
   (`git rev-list --all`) par lots et cherche, avec `git grep -I -E` :
   - adresses courriel (puis classe-les selon les règles de `CLAUDE.md` : génériques permises
     ou non) ;
   - champs `"notes": "` non vides dans `data.json` ;
   - numéros de téléphone dans des textes libres ;
   - motifs de secrets : `sk-ant-`, `ghp_`, `github_pat_`, `AKIA`, `-----BEGIN`,
     `xox[bp]-`, `AIza`, mots `password`, `secret`, `token` suivis d'une valeur.
2. Liste les fichiers qui ont existé puis ont disparu (`git log --all --diff-filter=D --name-only`)
   et repère ceux qui ressemblent à des données privées (`*.prive.json`, sources, exports,
   documents internes, pièces jointes).
3. Cherche dans les messages de commit les mentions de données personnelles ou de retraits à la
   demande d'une personne (`git log --all --format=%H%x09%s`), et vérifie si la donnée retirée est
   encore lisible dans un commit antérieur.
4. Pour chaque constat : commit court, date, fichier, type de donnée, encore présente dans `HEAD`
   ou non, gravité. **Jamais la valeur.**
5. Propose les options (sans rien faire) : réécriture de l'historique (`git filter-repo`), purge
   des caches GitHub, rotation d'une clé, avec leurs conséquences (clones existants, branche
   `brouillon`, dépôt de l'aperçu `TrouveTaClinique/apercu`, robots).

#### Rappel
N'ouvre aucun ticket, ne pousse rien, ne modifie aucune référence git.

### Mission 04 : sécurité technique

Rapport : `audit-cursor/rapports/04-securite-technique.md`.

#### Étapes
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

#### À rendre
Le rapport habituel, constats classés par gravité.

### Mission 05 : contenu des guides PTEM, PTEM-U (PREM-U) et AMP

Rapport : `audit-cursor/rapports/05-contenu-ptem-amp.md`.

#### But
Ces pages guident des médecins dans des démarches administratives réelles. Une erreur de date,
de règle ou de lien peut leur nuire. Vérifier chaque affirmation contre les sources officielles.

#### Étapes
1. Sources des pages : `scripts/sources/*.html` (pages générées : `/monteregie-est/ptem/`,
   `/monteregie-est/ptem-u/`, `/monteregie-est/amp/`).
2. Découpe chaque page en affirmations vérifiables (dates, délais, conditions, nombres de postes,
   étapes, organismes, liens). Pour chacune, trouve la source officielle actuelle (DTMF de la
   Montérégie, Santé Québec, RAMQ, Québec.ca, MSSS, FMOQ, FMRQ) et classe :
   **conforme**, **à corriger** (avec le texte proposé et la source), **périmée**, **à vérifier**.
3. Vérifie chaque lien sortant (répond-il, mène-t-il au bon document, sans redirection vers une
   page générale ?).
4. Règles d'écriture du projet : « Nouveau facturant (NF) » et jamais l'inverse ;
   « (PREM-U) » accolé à chaque mention de PTEM-U ; une phrase par ligne avec `<br>` dans les
   paragraphes narratifs ; aucun tiret cadratin ; source citée.
5. Clarté pour un résident : ce qui manque, ce qui prête à confusion, ce qui devrait être en tête.

#### À rendre
Le rapport habituel, plus un tableau « affirmation → statut → source (adresse, date consultée) →
texte proposé », page par page. Ne modifie aucune source.

### Mission 06 : données des cliniques et des établissements

Rapport : `audit-cursor/rapports/06-donnees-cliniques.md`. Sorties brutes : `rapports/bruts/06-*`.

#### Fichiers
`data.json` (clés `miseAJour`, `annonce`, `hopitaux`, `cliniques`), `data-etablissements.json`
(Est), `data-etablissements-centre.json` (Centre), territoires `territoires-monteregie.js`,
`territoires-rls-est.js`, `territoires-rls-centre-ouest.js`.

#### Étapes
1. Écris un script de validation dans `rapports/outils-temp/` :
   - champs attendus présents et bien typés, identifiants uniques, doublons (nom, adresse,
     coordonnées) ;
   - coordonnées dans la Montérégie, puis **point dans le polygone** : la clinique tombe-t-elle
     dans le territoire de son RLS (`rls`) et de sa région (`region`) ?
   - téléphones au bon format, adresses web au bon format, villes cohérentes avec l'adresse ;
   - `notes` vide partout ; fiches `visible: false` ; fiches `contactMasque` ;
   - cohérence des champs de recrutement, des niveaux, des horaires et des dates.
2. Vérifie que chaque site web de clinique répond (une requête par seconde au plus) et mène à
   la bonne clinique (titre de la page). Liste les sites brisés, redirigés ou douteux.
3. Établissements : installations, secteurs, responsables, courriels selon les règles de
   `CLAUDE.md` (Est permis dans `data-etablissements.json` seulement ; Centre et Ouest :
   « À venir »).
4. Compare un échantillon de 15 cliniques avec une source publique (site de la clinique, Santé
   Québec, répertoire des GMF) : nom, adresse, téléphone, statut GMF ou GMF-U. Cite la source.
5. Données manquantes qui nuisent à l'usage (fiches presque vides, champs absents en nombre).

#### À rendre
Le rapport habituel ; pour les problèmes nombreux, un tableau par identifiant de fiche dans
`rapports/bruts/06-*.md`, sans aucun courriel ni téléphone recopié.

### Mission 07 : catalogue de guides cliniques

Rapport : `audit-cursor/rapports/07-catalogue-guides.md`. Sorties brutes : `rapports/bruts/07-*`.

#### Fichier
`guides/donnees.json` (834 guides et 388 organismes au 28 oct. 2026 ; cette mission traite les
guides, la mission 08 les organismes). Règles : section « Catalogue de guides » de `CLAUDE.md`.

#### Étapes
1. Lance `node scripts/verifier-liens-guides.js --rapport audit-cursor/rapports/bruts/07-liens.md`.
   Pour chaque lien brisé, redirigé ou « à vérifier » : trouve l'adresse directe correcte du
   même document chez l'organisme (ou constate qu'il n'existe plus) et propose le remplacement.
2. Contrôle chaque fiche selon les règles du projet :
   - lien direct vers le guide ou le PDF, jamais vers une page qui liste d'autres documents ;
   - titre « Sujet : précision », sans trait d'union collé comme séparateur ;
   - `cat` = sujet clinique de `ORDRE_SUJETS` (`scripts/generer-guides-cliniques.cjs`) ;
   - « (EN) » à la fin du titre d'un document anglais, et existe-t-il une version française ?
   - source québécoise ou canadienne ; utile à un médecin de famille ;
   - `ajoute`, `verifie`, `format` présents ; accès réservé signalé (`acces: "abonnement"`).
3. Doublons : même document à deux adresses, titres presque identiques, versions successives
   d'un même guide.
4. Éditions périmées : pour les grandes lignes directrices (Hypertension Canada, Diabète Canada,
   Société canadienne de cardiologie, Société canadienne de thoracologie, INESSS, SOGC, Société
   canadienne de pédiatrie, CMFC, Thrombose Canada…), une édition plus récente existe-t-elle ?
   Donne l'adresse directe vérifiée.
5. Classement : fiches dans le mauvais sujet ou au mauvais type (guide, algorithme, outil,
   document pour le patient).
6. Lacunes : sujets fréquents en médecine familiale sans ressource ou avec une seule ressource
   anglaise ; propose au plus 30 ajouts, avec adresse directe vérifiée, organisme, sujet et type.

#### À rendre
Le rapport habituel, plus un tableau de corrections prêt à appliquer : fiche (titre actuel),
champ, valeur actuelle, valeur proposée, preuve.

### Mission 08 : ressources communautaires

Rapport : `audit-cursor/rapports/08-ressources-communautaires.md`. Sorties brutes : `rapports/bruts/08-*`.

#### Fichier
Fiches `type: "communautaire"` de `guides/donnees.json` (388). Sources : bottins de 2023 et
répertoires des CDC (voir `CLAUDE.md`), d'où un risque de données périmées.

#### Étapes
1. Script de contrôle dans `rapports/outils-temp/` : champs propres (`rubrique`, `rubriques`,
   `ville`, `adresse`, `telephone`, `pourQui`, `heures`, `acces`, `services`, `sourcePage`),
   doublons, formats de téléphone, villes, mention « (hors territoire) » cohérente avec la liste
   des municipalités de la Montérégie-Est.
2. Site web de chaque organisme (une requête par seconde au plus) : répond-il, est-ce le bon
   organisme, l'organisme existe-t-il encore (fermeture, fusion, déménagement, changement de
   nom) ? Pour les lignes provinciales (211, Info-Social 811, 9-8-8, Info-aidant, Centre
   antipoison, Tel-jeunes…), vérifie numéro et site sur la source officielle.
3. Rubriques : cohérence du classement ; organismes mal classés ; rubriques trop vastes.
4. Organismes importants de la Montérégie-Est absents (banques alimentaires, hébergement,
   violence conjugale, santé mentale, proches aidants, aînés, jeunesse) : propose au plus 30
   ajouts avec source vérifiée.

#### Rappel
Aucun numéro de téléphone recopié dans le rapport : identifie l'organisme par son nom (nom
d'organisme, pas de personne) et le champ concerné.

### Mission 09 : moteur de recherche des guides

Rapport : `audit-cursor/rapports/09-recherche-guides.md`. Sorties brutes : `rapports/bruts/09-*`.

#### Fichiers
`assets/guides-recherche.js` (synonymes `GROUPES`, concepts `CONCEPTS`, `estCommunautaire`,
`rechercherParType`), `assets/guides-cliniques.js` (indexation de la page), tests
`scripts/test-recherche-guides.cjs` (modèle pour charger le moteur dans Node).

#### Étapes
1. Écris un banc d'essai Node dans `rapports/outils-temp/` qui indexe le catalogue comme la page
   et classe les résultats comme elle (`rechercherParType`, page des guides et page des
   ressources communautaires).
2. Prépare au moins 150 requêtes réalistes de médecins et de résidents : symptômes en langage
   courant, abréviations québécoises (MPOC, IVRS, SUA, OMI, SCPD, DFG, HTA, FA, ITSS, TNC…),
   noms de médicaments, fautes de frappe, accents oubliés, anglais, documents pour le patient,
   besoins communautaires (aide alimentaire, répit, hébergement…), requêtes de procédures.
3. Pour chaque requête : les 5 premiers résultats et ton jugement (bon, moyen, mauvais, rien).
   Calcule les taux par catégorie de requête.
4. Pour les échecs : cause probable (synonyme manquant, concept absent, mot vide, poids) et
   ajout proposé à `GROUPES` ou `CONCEPTS`, en vérifiant qu'il ne crée pas de faux positifs
   ailleurs (relance le banc avec la proposition, dans le banc seulement).
5. Performance : temps d'indexation et de recherche sur le catalogue complet.

#### Rappel
La « requête surprise » (`SURPRISE`) : ne cherche pas à la retrouver, ne l'écris nulle part.

### Mission 10 : aiguillage par IA (sans aucun appel payant)

Rapport : `audit-cursor/rapports/10-aiguillage-ia.md`.

#### Fichiers
`workers/aiguillage/` (`src/index.js`, `src/logique.js`, `src/contact.js`, `wrangler.toml`,
`README.md`, `test/`), `assets/guides-aiguillage.js`, page `/confidentialite/`.

#### Étapes
1. Tests : `node --test workers/aiguillage/test/logique.test.js` ; puis, dans
   `workers/aiguillage`, `npm ci` et `npm test` (le dossier `node_modules` est ignoré par git).
2. Banc d'essai en simulation seulement :
   `node workers/aiguillage/test/comparaison/comparer-modeles.mjs --simulation`
   (aucun appel réel ; les résultats vont dans un dossier ignoré par git).
3. Revue du prompt (`INSTRUCTIONS`) : l'IA ne doit jamais répondre à la question clinique ;
   résistance aux consignes glissées dans la question ; clarté ; cas limites (question vide de
   sens, question en anglais, question communautaire posée sur la page des guides).
4. Coûts : taille du catalogue envoyé (complet et allégé, voir `catalogueSelonPage`), cache,
   plafond quotidien, limites par minute ; estime le coût par question et le pire cas par jour.
5. Interface : attente, erreurs, effacement des suggestions (`effacerSuggestions`),
   accessibilité de la zone de résultats (annonce aux lecteurs d'écran), comportement hors ligne.
6. Cohérence entre ce que fait le service et ce qu'en dit la page de confidentialité.

#### Interdit
Appeler le service en ligne, l'API d'Anthropic ou la boîte « Demander à l'IA » du site.

### Mission 11 : accessibilité (WCAG 2.2, niveau AA)

Rapport : `audit-cursor/rapports/11-accessibilite.md`. Captures : `rapports/captures/11-*`.

#### Outils
Playwright et `@axe-core/playwright`, installés dans un dossier temporaire hors du dépôt.
Pages : la section « Pages de référence » (site en ligne).

#### Étapes
1. axe-core sur chaque page de la section « Pages de référence », en largeur ordinateur (1280 px) et téléphone
   (390 px) ; regroupe les violations par règle et par gabarit.
2. Clavier seulement : lien d'évitement, ordre de tabulation, focus visible, pièges au clavier
   (cartes, menus, boîte de dialogue, filtres des guides, favoris), touche Échap.
3. Agrandissement à 200 % et 400 % (refusion sans défilement horizontal), espacement du texte,
   `prefers-reduced-motion`, mode sombre s'il existe.
4. Contrastes : couleurs de la marque, boutons, pastilles, texte sur image, liens.
5. Formulaires : recherche, filtres, boîte « Demander à l'IA » (sans rien envoyer), formulaire
   « Nous joindre » (sans rien envoyer) : étiquettes, messages d'erreur, annonces.
6. Cartes : alternative textuelle (répertoire sous la carte), marqueurs atteignables au clavier,
   fenêtres d'information lisibles par un lecteur d'écran.
7. Structure : `lang`, titres hiérarchisés, repères (`main`, `nav`), textes de liens,
   images et icônes, cibles tactiles d'au moins 24 px.

#### À rendre
Le rapport habituel, chaque correction indiquée dans la **source** (gabarit, feuille de style,
script de génération), jamais dans une page générée.

### Mission 12 : téléphone, applications installables et hors ligne

Rapport : `audit-cursor/rapports/12-mobile-pwa.md`. Captures : `rapports/captures/12-*`.

#### Étapes
1. Avec Playwright (hors du dépôt), ouvre chaque page de la section « Pages de référence » en 320, 360,
   390, 414, 768 et 1024 px : défilement horizontal, chevauchements, textes coupés, boutons
   trop petits, éléments fixes qui cachent le contenu. Captures dans `rapports/captures/`.
2. Cartes au téléphone : fond en images sous 860 px, effet aimant entre la carte et le
   répertoire (`repertoire-aimant`, défilement), localisation, fenêtres d'information.
3. Deux applications installables : `/monteregie-est/` (`sw.js`, `manifest-est.webmanifest`)
   et « Guides » (`guides/sw.js`, `guides/manifest.webmanifest`) ; aussi `manifest.json`.
   Manifestes valides, icônes, portée, page de départ ; stratégie de cache de chaque service
   worker, version de cache, mise à jour (une personne qui a installé l'app voit-elle la
   nouvelle version ?), comportement hors ligne (coupe le réseau dans Playwright).
4. Risques : données périmées servies hors ligne, pages qui restent en cache après une
   correction, mélange entre les deux applications.

#### À rendre
Le rapport habituel, avec les captures citées par leur nom de fichier.

### Mission 13 : performance

Rapport : `audit-cursor/rapports/13-performance.md`. Sorties brutes : `rapports/bruts/13-*`.

#### Étapes
1. Lighthouse en mode téléphone (`npx --yes lighthouse <adresse> --form-factor=mobile
   --output=json --output-path=...`, dans un dossier hors du dépôt, Chrome requis) sur les
   pages principales de la section « Pages de référence », trois passages chacune ; garde la médiane.
2. Poids : `data.json`, `data-etablissements*.json`, `guides/donnees.json`, scripts des cartes
   (Leaflet, MapLibre), polices de `assets/polices/`, images, vidéo, fichiers de territoires.
   Qu'est-ce qui est chargé et n'est pas utilisé sur chaque page ?
3. Délais : affichage de la carte, préparation de l'index de recherche des guides
   (1 200 fiches), interaction pendant la saisie.
4. Mise en cache : en-têtes renvoyés par GitHub Pages (durée de 10 minutes), versions dans les
   adresses (`?v=`), service workers ; risque de servir des fichiers périmés.
5. Pour chaque piste : gain estimé (mesuré si possible), effort, risque.

#### À rendre
Le rapport habituel, avec les mesures avant toute recommandation.

### Mission 14 : référencement, données structurées et liens internes

Rapport : `audit-cursor/rapports/14-seo.md`. Sorties brutes : `rapports/bruts/14-*`.

#### Étapes
1. Parcours poli (une requête par seconde) de toutes les adresses de
   https://trouvetaclinique.ca/sitemap.xml et des liens internes trouvés : code HTTP,
   redirections, `canonical`, `title` (longueur, doublons), `meta description`, `h1`, `robots`
   (noindex), Open Graph, langue.
2. Liens internes brisés ou qui redirigent ; pages orphelines (publiées mais liées nulle part) ;
   pages liées mais absentes du plan du site.
3. Données structurées (JSON-LD) : syntaxe et types schema.org de chaque gabarit (accueil,
   fiches, vidéo `VideoObject`, catalogue `CollectionPage`…) ; teste quelques pages avec
   https://validator.schema.org/ (adresse publique seulement).
4. Règles du projet : `/carte-recrutement-est/` en noindex et absente du plan ;
   `/carte-interactive/` renvoie vers `/monteregie/` ; dates `lastmod` cohérentes
   (`scripts/lastmod.json`) ; `robots.txt` ; `llms.txt` ; fichier de clé IndexNow ; page 404.
5. Contenu mince ou dupliqué : fiches presque vides, titres identiques, textes répétés entre
   régions.
6. Propose les corrections dans les sources (script ou gabarit), jamais dans les pages générées.

### Mission 15 : cartes

Rapport : `audit-cursor/rapports/15-cartes.md`. Captures : `rapports/captures/15-*`.

#### Pages et sources
`/monteregie-est/`, `/monteregie/` (et `?region=Centre`, `?region=Ouest`),
`/carte-recrutement-est/` ; sources `scripts/carte-est-sq.template.html`,
`scripts/carte.template.html`, `scripts/generer-carte-sq-complete.js`, `scripts/publier-regions.js`.

#### Étapes
1. Avec Playwright (hors du dépôt), ordinateur et téléphone : erreurs de la console, nombre de
   marqueurs comparé aux fiches visibles de `data.json`, filtres, recherche, fenêtres
   d'information, bouton de localisation (permission refusée et accordée), menu « i ».
2. Règles du projet (voir `CLAUDE.md`) :
   - carte de l'Est hermétique : aucun lien vers une autre page du site (sauf ce que
     `CLAUDE.md` permet) ; même règle pour la version autonome ;
   - courriels : affichés pour les cliniques et secteurs de l'Est sur la carte de l'Est
     seulement ; sur `/monteregie/`, adresse générale du recrutement pour l'Est ; « À venir »
     pour le Centre et l'Ouest ;
   - crédits : bande d'attribution sur une ligne au téléphone, nom du propriétaire permis sur
     les cartes ; aucun encadré de collaboration ;
   - noms de lieux en français sur le fond vectoriel.
3. Fonds de carte : vectoriel à l'ordinateur, images au téléphone ; que se passe-t-il si le
   fournisseur de tuiles ne répond pas ?
4. Revue du code des gabarits : robustesse si une fiche a un champ manquant, échappement des
   données insérées dans le HTML, taille et lisibilité du gabarit.

#### Rappel
Pas de courriel ni de nom de personne dans le rapport.

### Mission 16 : code, scripts de génération et tests

Rapport : `audit-cursor/rapports/16-code-et-tests.md`.

#### Étapes
1. Déterminisme, dans une copie temporaire (`git worktree add ../ttc-audit-16 HEAD`) : lance
   deux fois `node scripts/generer-pages-seo.js` puis `node scripts/publier-regions.js` ;
   après chaque passage, `git status` et `git diff --stat` dans la copie. Toute différence est un
   constat. Mesure les durées. Supprime la copie à la fin.
2. Tests : liste chaque règle de `CLAUDE.md` et indique quel test ou quelle vérification la
   protège ; les règles sans protection sont des constats. Repère les tests fragiles (dates,
   réseau, ordre).
3. Qualité : taille et découpage des grands scripts (`generer-pages-seo.js`, `publier-regions.js`,
   `generer-guides-cliniques.cjs`), code mort, duplication, gestion des erreurs, chemins propres
   à un système, version de Node requise, dépendances.
4. Robots GitHub : enchaînement, ce qui arrive en cas d'échec, risques de boucle de commits
   automatiques, durée.
5. Compatibilité Windows des scripts que le propriétaire pourrait lancer.

#### À rendre
Le rapport habituel ; pour chaque refonte proposée, le bénéfice concret et le risque.

### Mission 17 : rédaction, français et cohérence

Rapport : `audit-cursor/rapports/17-redaction.md`. Sorties brutes : `rapports/bruts/17-*`.

#### Étapes
1. Extrais le texte visible de toutes les pages publiées (version produite par
   `scripts/preparer-pages-production.js` dans un dossier temporaire, ou site en ligne).
2. Orthographe, grammaire, typographie du français du Québec (espaces avant `:`, guillemets
   « », majuscules, abréviations), anglicismes ; aucun tiret cadratin.
3. Terminologie constante : GMF, GMF-U, RLS, PREM, PTEM, PTEM-U (PREM-U), AMP, « Nouveau
   facturant (NF) », noms des établissements et des CISSS, Santé Québec.
4. Années et dates périmées, mentions d'événements passés, promesses non tenues (« bientôt »).
5. Mentions obligatoires selon `CLAUDE.md` : indépendance (accueil, À propos, guides) ;
   adresse `contact@trouvetaclinique.ca` ; nom du propriétaire seulement sur les cartes.
6. Page de confidentialité : correspond-elle à ce que fait vraiment le site (service d'IA,
   Cloudflare, Anthropic, stockage local du navigateur, mesures d'audience, fonds de carte) ?
7. Clarté pour un résident pressé : phrases longues, jargon, informations clés enfouies.

#### À rendre
Un tableau « page → texte actuel (court) → correction → fichier source à modifier ».

### Mission 18 : idées d'amélioration (facultative)

Rapport : `audit-cursor/rapports/18-idees.md`.

#### But
Proposer, sans rien construire, les améliorations les plus utiles aux résidents et aux médecins
de famille qui cherchent un milieu de pratique en Montérégie, ou qui utilisent le catalogue de
guides.

#### Étapes
1. Parcours le site comme trois personnes : résidente de 2e année qui choisit son futur milieu ;
   médecin qui change de région ; médecin en clinique qui cherche un guide entre deux patients.
   Note les frictions.
2. Propose au plus 20 idées. Pour chacune : problème réglé, pour qui, effort (petit, moyen,
   grand), risques (données à tenir à jour, confidentialité, coûts), et ce qui existe déjà dans
   le projet qu'on pourrait réutiliser.
3. Classe-les par rapport valeur / effort.

#### Limite
Respecte les décisions déjà prises dans `CLAUDE.md` (carte de l'Est hermétique, aucun texte
rédigé par l'IA affiché, courriels masqués, etc.) ; si une idée les remet en cause, dis-le.

### Mission 19 : synthèse (à faire en dernier)

Rapport : `audit-cursor/rapports/19-synthese.md`.

#### Étapes
1. Lis tous les rapports de `audit-cursor/rapports/` (pas les sorties brutes).
2. Fusionne les doublons, vérifie au besoin les constats contradictoires.
3. Plan d'action :
   - **P1, à corriger tout de suite** : fuites de données, failles, fonctions brisées, erreurs
     de contenu qui peuvent tromper un médecin ;
   - **P2, ce mois-ci** ; **P3, quand possible** ; **P4, idées**.
   Pour chaque action : identifiants des constats, effort (petit, moyen, grand), fichiers
   sources touchés, risque.
4. Liste unique des questions pour le propriétaire.
5. Lance `node audit-cursor/outils/assembler-rapports.mjs`, qui produit
   `audit-cursor/rapports/AUDIT-COMPLET.md` et signale toute donnée personnelle oubliée dans
   un rapport. Corrige le rapport en cause s'il y en a une, puis relance.
6. Termine par `git status --porcelain`, qui doit être vide.
