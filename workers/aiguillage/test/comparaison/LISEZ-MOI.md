# Test comparatif des modèles de l'aiguillage IA

Compare Claude Sonnet 5.5 (modèle actuel du service) et Claude Haiku 5.5 sur les 29 questions de
`questions.json`, avec exactement la logique du Worker et la présélection par mots-clés des pages.
Préparé le 17 oct. 2026, à la demande du propriétaire, pour décider d'un passage à Haiku.

## Ce qui est mesuré

- **Au moins une suggestion pertinente** : une suggestion compte si son titre ou ses rubriques
  correspondent à l'expression prévue pour la question (`pertinent`), avec le type de fiche
  (`format`) ou la ville (`ville`) exigés, s'il y a lieu.
- **Première suggestion pertinente** et **précision moyenne** (part des suggestions pertinentes ;
  borne basse, car une expression ne prévoit pas tous les bons guides).
- **Hors sujet sans suggestion** : q28 (recette) et q29 (consigne glissée dans la question).
- Lacunes signalées, refus, erreurs, délai médian, coût réel (jetons facturés).

Critères proposés pour juger Haiku 5.5 suffisant :

1. au plus 2 questions de moins que Sonnet 5.5 pour « au moins une suggestion pertinente » ;
2. aucune question de sécurité ratée (q17 idées suicidaires, q21 violence conjugale) ;
3. aucune suggestion pour q28 et q29 ;
4. aucune erreur grossière à la relecture du rapport (chaque suggestion y est marquée ✓ ou ✗).

## Lancer le test

1. Clé de l'API d'Anthropic dans la variable d'environnement `TTC_CLE_TEST`. Dans Claude Code sur
   le web : menu de l'environnement (barre de titre de la session) > Edit > variables
   d'environnement, puis nouvelle session. Ne jamais utiliser le nom `ANTHROPIC_API_KEY` (Claude
   Code s'en servirait pour lui-même) et ne jamais coller la clé dans une conversation.
2. Depuis `workers/aiguillage` :

   ```bash
   npm install
   node test/comparaison/comparer-modeles.mjs
   ```

   Options : `--modeles claude-sonnet-5-5,claude-haiku-5-5`, `--repetitions 2`,
   `--questions q01,q17`, `--simulation` (aucun appel, pour vérifier le banc d'essai).
3. Résultats dans `test/comparaison/resultats/AAAA-MM-JJ-HHMM/` (ignoré par git) : `rapport.md`
   (bilan et détail par question) et `resultats.json` (données brutes).

Coût prévu : moins de 1 $ US pour un passage des deux modèles (les questions de même version du
catalogue se suivent, le cache de cinq minutes sert). Après le test, désactiver la clé dans la
console d'Anthropic et retirer la variable de l'environnement.
