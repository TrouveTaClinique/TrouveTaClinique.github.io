# Réconciliation base maître ↔ data.json

Date : 2 septembre 2026  
Source : audit Main/Brouillon + `data.json` courant.

## Constat

La base maître Google contient environ 64 lignes, alors que `data.json` en compte 127
objets (89 cliniques publiées, 7 établissements, 31 hors publication, plus hôpitaux).

Les **33 cliniques déjà publiées** absentes de la base maître sont listées dans
`scripts/reconciliation-maitre-33-absents.csv` (identifiants, coordonnées, courriel
restauré lorsqu’il était connu).

Les IDs **56, 57 et 58** du Sheet sont marqués « Non publiée » et ne doivent **pas**
être réintroduits automatiquement.

## Marche à suivre

1. Ouvrir la [base maître](https://docs.google.com/spreadsheets/d/14nUZttoVhpLLR8ZjAnFcLtV2yD-eLOKW-l7j5s9IvbY/edit).
2. Créer un instantané (menu Apps Script / fonction `creerInstantane`).
3. Importer ou saisir les 33 lignes du CSV, en conservant les **ID stables**.
4. Vérifier latitude/longitude (doivent rester identiques au JSON).
5. Ne pas lancer d’export destiné à remplacer `data.json` tant que le rapprochement
   n’est pas complet et que l’archive Apps Script active n’a pas été mise à jour
   (`PTEM2027_v2.gs` du dépôt, version `v2-2026-09-02`).
6. Produire un export de **contrôle** uniquement, comparer le diff, puis décider.

## Courriels

Décision du 2 septembre 2026 : les courriels de recrutement sont à nouveau publiés.
47 adresses ont été restaurées dans `data.json` depuis la révision
`3193b508` (avant le retrait). Les fiches encore vides devront être complétées via
le formulaire ou la base maître.
