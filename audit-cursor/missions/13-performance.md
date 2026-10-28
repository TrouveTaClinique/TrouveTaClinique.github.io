# Mission 13 : performance

Rapport : `audit-cursor/rapports/13-performance.md`. Sorties brutes : `rapports/bruts/13-*`.

## Étapes
1. Lighthouse en mode téléphone (`npx --yes lighthouse <adresse> --form-factor=mobile
   --output=json --output-path=...`, dans un dossier hors du dépôt, Chrome requis) sur les
   pages principales de `audit-cursor/PAGES.md`, trois passages chacune ; garde la médiane.
2. Poids : `data.json`, `data-etablissements*.json`, `guides/donnees.json`, scripts des cartes
   (Leaflet, MapLibre), polices de `assets/polices/`, images, vidéo, fichiers de territoires.
   Qu'est-ce qui est chargé et n'est pas utilisé sur chaque page ?
3. Délais : affichage de la carte, préparation de l'index de recherche des guides
   (1 200 fiches), interaction pendant la saisie.
4. Mise en cache : en-têtes renvoyés par GitHub Pages (durée de 10 minutes), versions dans les
   adresses (`?v=`), service workers ; risque de servir des fichiers périmés.
5. Pour chaque piste : gain estimé (mesuré si possible), effort, risque.

## À rendre
Le rapport habituel, avec les mesures avant toute recommandation.
