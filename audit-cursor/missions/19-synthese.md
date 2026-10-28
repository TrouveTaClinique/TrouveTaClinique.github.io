# Mission 19 : synthèse (à faire en dernier)

Rapport : `audit-cursor/rapports/19-synthese.md`.

## Étapes
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
