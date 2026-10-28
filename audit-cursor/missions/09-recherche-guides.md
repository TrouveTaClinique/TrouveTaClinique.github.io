# Mission 09 : moteur de recherche des guides

Rapport : `audit-cursor/rapports/09-recherche-guides.md`. Sorties brutes : `rapports/bruts/09-*`.

## Fichiers
`assets/guides-recherche.js` (synonymes `GROUPES`, concepts `CONCEPTS`, `estCommunautaire`,
`rechercherParType`), `assets/guides-cliniques.js` (indexation de la page), tests
`scripts/test-recherche-guides.cjs` (modèle pour charger le moteur dans Node).

## Étapes
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

## Rappel
La « requête surprise » (`SURPRISE`) : ne cherche pas à la retrouver, ne l'écris nulle part.
