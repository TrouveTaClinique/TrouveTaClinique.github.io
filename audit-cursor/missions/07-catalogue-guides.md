# Mission 07 : catalogue de guides cliniques

Rapport : `audit-cursor/rapports/07-catalogue-guides.md`. Sorties brutes : `rapports/bruts/07-*`.

## Fichier
`guides/donnees.json` (834 guides et 388 organismes au 28 oct. 2026 ; cette mission traite les
guides, la mission 08 les organismes). Règles : section « Catalogue de guides » de `CLAUDE.md`.

## Étapes
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

## À rendre
Le rapport habituel, plus un tableau de corrections prêt à appliquer : fiche (titre actuel),
champ, valeur actuelle, valeur proposée, preuve.
