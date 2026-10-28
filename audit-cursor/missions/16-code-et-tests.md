# Mission 16 : code, scripts de génération et tests

Rapport : `audit-cursor/rapports/16-code-et-tests.md`.

## Étapes
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

## À rendre
Le rapport habituel ; pour chaque refonte proposée, le bénéfice concret et le risque.
