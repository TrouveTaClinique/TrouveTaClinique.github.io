# Mission 01 : état initial et carte du projet

Rapport : `audit-cursor/rapports/01-carte-du-projet.md`. À faire en premier.

## But
Établir l'état de départ et une carte fiable du projet, qui servira aux autres missions.

## Étapes
1. Lance `node audit-cursor/outils/etat-initial.mjs` : il écrit `rapports/00-etat-initial.md`
   (commit, tests, vérifications). Résume son résultat ; tout échec est un constat.
2. Lis `CLAUDE.md`, `README.md`, `CHANGELOG.md`, `LISEZ-MOI.txt`, `docs/`,
   `scripts/NOTES-REDIRECTIONS-SEO.md`, `scripts/RECONCILIATION-MAITRE.md`,
   `workers/aiguillage/README.md` et les quatre robots de `.github/workflows/`.
3. Pour chaque type de page publiée (voir `audit-cursor/PAGES.md` et la liste blanche de
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

## À rendre
Le rapport habituel, plus : le tableau « page publiée → source → script → tests », le schéma du
chemin de publication (texte), et la liste des écarts entre `CLAUDE.md` et le code.
