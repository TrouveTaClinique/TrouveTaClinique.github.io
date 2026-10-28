# Mission 10 : aiguillage par IA (sans aucun appel payant)

Rapport : `audit-cursor/rapports/10-aiguillage-ia.md`.

## Fichiers
`workers/aiguillage/` (`src/index.js`, `src/logique.js`, `src/contact.js`, `wrangler.toml`,
`README.md`, `test/`), `assets/guides-aiguillage.js`, page `/confidentialite/`.

## Étapes
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

## Interdit
Appeler le service en ligne, l'API d'Anthropic ou la boîte « Demander à l'IA » du site.
