# Mission 08 : ressources communautaires

Rapport : `audit-cursor/rapports/08-ressources-communautaires.md`. Sorties brutes : `rapports/bruts/08-*`.

## Fichier
Fiches `type: "communautaire"` de `guides/donnees.json` (388). Sources : bottins de 2023 et
répertoires des CDC (voir `CLAUDE.md`), d'où un risque de données périmées.

## Étapes
1. Script de contrôle dans `rapports/outils-temp/` : champs propres (`rubrique`, `rubriques`,
   `ville`, `adresse`, `telephone`, `pourQui`, `heures`, `acces`, `services`, `sourcePage`),
   doublons, formats de téléphone, villes, mention « (hors territoire) » cohérente avec la liste
   des municipalités de la Montérégie-Est.
2. Site web de chaque organisme (une requête par seconde au plus) : répond-il, est-ce le bon
   organisme, l'organisme existe-t-il encore (fermeture, fusion, déménagement, changement de
   nom) ? Pour les lignes provinciales (211, Info-Social 811, 9-8-8, Info-aidant, Centre
   antipoison, Tel-jeunes…), vérifie numéro et site sur la source officielle.
3. Rubriques : cohérence du classement ; organismes mal classés ; rubriques trop vastes.
4. Organismes importants de la Montérégie-Est absents (banques alimentaires, hébergement,
   violence conjugale, santé mentale, proches aidants, aînés, jeunesse) : propose au plus 30
   ajouts avec source vérifiée.

## Rappel
Aucun numéro de téléphone recopié dans le rapport : identifie l'organisme par son nom (nom
d'organisme, pas de personne) et le champ concerné.
