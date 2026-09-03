# Rapport de livraison — 31 août 2026 (archive)

Date : 31 août 2026  
Projet : Trouve ta clinique  

Document d’archive. Il décrit l’état du chantier à la clôture de l’étape 4.
La production est aujourd’hui servie depuis `main` sur trouvetaclinique.ca.

## État livré à cette date

Cette archive contenait le site validé à l’étape 4, notamment :

- la nouvelle page d’accueil;
- la carte complète dans `/monteregie/`;
- les trois cartes régionales;
- le thème Santé Québec et le header V4 sur les cartes;
- le header sobre avec logo sur les autres pages;
- la couche indépendante de 7 établissements, désactivée par défaut;
- le bouton `(i)` explicatif sans compteur dans le libellé;
- les pages de cliniques, de RLS, PTEM et AMP;
- la PWA limitée à Montérégie-Est;
- les générateurs, garde-fous et documents d’entretien.

Le détail des validations est conservé dans `RAPPORT-QA-ETAPE-4.md`.

## Situation du repo à cette date

Le 31 août 2026, le nouveau dépôt GitHub existait mais était encore vide : aucune branche
et aucun commit. Aucune écriture GitHub n’avait encore été effectuée depuis cette archive.

## Préparation alors demandée au propriétaire

Ces étapes ont ensuite été réalisées hors de ce rapport (import de `main`, secrets GitHub,
branche `brouillon`, aperçu sur apercu.trouvetaclinique.ca).

1. Importer ou transférer la version officielle alors en ligne dans la branche `main`.
2. Vérifier que le site officiel demeure accessible pendant la migration.
3. Configurer dans les secrets GitHub Actions le secret de protection prévu par le projet.
4. Créer la branche `brouillon` depuis `main`.

## Limite notée à cette date

Les validations techniques étaient réussies. L’inspection visuelle automatisée bureau et
mobile restait à effectuer dès qu’un navigateur de test ou une prévisualisation privée
serait disponible.
