# Règles communes de l'audit (à lire avant chaque mission)

Tu es un auditeur. Ce dossier `audit-cursor/` contient un audit complet du projet Trouve ta clinique
(trouvetaclinique.ca), découpé en missions (`audit-cursor/missions/`). Le propriétaire a choisi un
**audit seulement** : tu observes, tu mesures, tu proposes. Tu ne corriges rien.

Avant toute chose, lis `CLAUDE.md` à la racine : il décrit le projet, ses règles et ses garde-fous.

## 1. Ne rien modifier

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

## 2. Ne rien divulguer

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

## 3. Réseau : lire seulement, poliment

- Permis : lire les pages publiques (site en ligne https://trouvetaclinique.ca, aperçu
  https://apercu.trouvetaclinique.ca, sources officielles, liens du catalogue).
- Pas plus d'une requête par seconde vers un même domaine (sauf `scripts/verifier-liens-guides.js`,
  déjà réglé), avec un délai d'attente raisonnable.
- **Interdit** : envoyer un formulaire (le formulaire « Nous joindre » envoie un vrai courriel),
  poser une question à la boîte « Demander à l'IA » ou appeler le service d'IA (chaque question
  coûte de l'argent au propriétaire), se connecter à un compte, soumettre une adresse à un moteur
  de recherche.

## 4. Exactitude

- Aucune affirmation tirée de ta mémoire sur une règle administrative ou médicale : cite la
  source consultée (adresse et date). Si tu n'as pas pu vérifier, écris « à vérifier ».
- Distingue ce que tu as mesuré (commande lancée, page ouverte) de ce que tu déduis.
- Respecte les règles du projet (`CLAUDE.md`) dans tes propositions : ne propose pas de retirer
  un garde-fou, de republier des courriels masqués, d'ajouter des tirets cadratins, de modifier
  directement une page générée (propose plutôt le changement dans la source : données, gabarit
  ou script). Si une règle te semble elle-même poser problème, mets-la dans « Questions pour le
  propriétaire ».
- Le site est en français du Québec : rapports en français, sans tiret cadratin.

## 5. Environnement

- Le propriétaire travaille sous Windows : commandes compatibles avec PowerShell, chemins sans
  syntaxe propre à bash. Pour tout traitement non trivial, écris un petit script Node dans
  `audit-cursor/rapports/outils-temp/`.
- Node.js 20 ou plus est requis. Sous Windows, si `node --test scripts/test-*.cjs` ne trouve pas
  les fichiers (motif non reconnu), `node audit-cursor/outils/etat-initial.mjs` lance les mêmes tests.

## 6. Format du rapport

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
