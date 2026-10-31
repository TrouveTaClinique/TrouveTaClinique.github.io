# Méga audit avec Cursor : mode d'emploi

Ce dossier prépare un audit complet de Trouve ta clinique, à faire avec Cursor, en 19 missions.
Cursor observe, mesure et écrit des rapports ; il ne modifie rien au projet. Ensuite, tu
transmets les rapports à Claude, vous les triez ensemble, et Claude applique les corrections que
tu valides (sur `brouillon`, puis sur `main` avec ton accord).

Tout est aussi réuni dans un seul document, au contenu identique : `AUDIT-CURSOR.md`.

## Avant de commencer (10 minutes)

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

   Il faut Node.js 20 ou plus (première ligne). La dernière ligne lance les tests du projet et
   écrit `audit-cursor/rapports/00-etat-initial.md`.
3. Choisis le modèle le plus puissant offert par Cursor, en mode Agent, et active le mode Max
   s'il est proposé : sur un projet de cette taille, c'est ce qui tire le meilleur parti de tes
   crédits.

## Lancer une mission

Ouvre une **nouvelle conversation** en mode Agent pour chaque mission et colle ce texte, en
changeant le nom du fichier :

```
Lis audit-cursor/REGLES.md, puis exécute la mission audit-cursor/missions/01-carte-du-projet.md.
```

- Quand Cursor demande d'approuver une commande : accepte `node`, `npx`, `git log`, `git grep`,
  `git show`, `git worktree` ; **refuse** `git commit`, `git push`, `git reset`, `git clean`,
  `git checkout` d'une autre branche, `npm install` dans le dossier du projet, et toute
  modification d'un fichier hors de `audit-cursor/rapports/`.
- Si la conversation devient trop longue, ouvre-en une nouvelle et écris : « Lis
  audit-cursor/REGLES.md, puis continue la mission 07 à partir de la section Suite à faire de son
  rapport. »
- Laisse l'ordinateur allumé pendant les missions longues (07, 08 et 14 vérifient des centaines
  de liens).

## Les missions

| N° | Mission | Besoins |
|---|---|---|
| 01 | Carte du projet et état initial (**en premier**) | |
| 02 | Ce qui est publié et confidentialité | |
| 03 | Historique git public | |
| 04 | Sécurité technique | |
| 05 | Contenu PTEM, PTEM-U (PREM-U) et AMP | Internet |
| 06 | Données des cliniques et établissements | Internet |
| 07 | Catalogue de guides cliniques | Internet, longue |
| 08 | Ressources communautaires | Internet, longue |
| 09 | Moteur de recherche des guides | |
| 10 | Aiguillage par IA (sans aucun appel payant) | |
| 11 | Accessibilité | Internet, Playwright |
| 12 | Téléphone, applications installables, hors ligne | Internet, Playwright |
| 13 | Performance | Internet, Chrome |
| 14 | Référencement et liens internes | Internet, longue |
| 15 | Cartes | Internet, Playwright |
| 16 | Code, scripts de génération et tests | |
| 17 | Rédaction et cohérence du français | |
| 18 | Idées d'amélioration (facultative) | Internet |
| 19 | Synthèse et plan d'action (**en dernier**) | |

Cursor installe lui-même Playwright ou Lighthouse dans un dossier temporaire, hors du projet.

### Plan sur cinq jours

- Jour 1 : missions 01 à 04.
- Jour 2 : missions 05 à 08.
- Jour 3 : missions 09 à 12.
- Jour 4 : missions 13 à 18.
- Jour 5 : mission 19, puis envoi des rapports à Claude.

Les missions 02 à 18 sont indépendantes : si Cursor permet plusieurs agents en même temps
(onglets ou agents en arrière-plan), lances-en plusieurs à la fois pour aller plus vite.

## À la fin

1. La mission 19 produit `audit-cursor/rapports/AUDIT-COMPLET.md`. Tu peux aussi le produire
   toi-même : `node audit-cursor/outils/assembler-rapports.mjs`. Ce script signale toute donnée
   personnelle oubliée dans un rapport : fais-la retirer par Cursor avant l'envoi.
2. Tape `git status` : aucun fichier modifié ne doit apparaître.
3. Envoie `AUDIT-COMPLET.md` à Claude, en glissant le fichier dans la conversation.

## Sécurité

- Les rapports restent sur ton ordinateur : git ignore le dossier `audit-cursor/rapports/`, qui
  n'est donc jamais envoyé sur GitHub (le dépôt est public).
- Aucune mission n'envoie de formulaire ni ne pose de question à l'IA du site : l'audit ne coûte
  rien sur ton compte Anthropic.
- Ce dossier n'est pas publié sur le site : la liste blanche de publication l'ignore.
