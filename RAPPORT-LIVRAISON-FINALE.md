# Rapport de livraison finale du brouillon

Date : 31 août 2026  
Projet : Trouve ta clinique  
Cible prévue : branche `brouillon` de `TrouveTaClinique/TrouveTaClinique.github.io`

## État livré

Cette archive contient le brouillon complet validé à l’étape 4, notamment :

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

## Situation du nouveau repo

Le repo existe, mais il est entièrement vide : aucune branche et aucun commit n’existent. Il est
donc impossible de créer `brouillon` à partir de `main` sans initialiser ou modifier `main`, ce qui
est expressément interdit sans autorisation.

Aucune écriture GitHub n’a été effectuée.

## Préparation requise par le propriétaire

1. Importer ou transférer la version officielle actuelle dans la branche `main` du nouveau repo.
2. Vérifier que le site officiel actuel demeure accessible pendant la migration.
3. Configurer dans les secrets GitHub Actions le secret de protection prévu par le projet.
4. Confirmer ensuite que la branche `brouillon` peut être créée depuis `main`.

Après cette confirmation, le contenu de l’archive pourra être déposé uniquement dans
`brouillon`. Aucun changement de `main`, de GitHub Pages ou du domaine ne devra être réalisé sans
une nouvelle autorisation explicite.

## Limite avant une publication officielle

Les validations techniques sont réussies. L’inspection visuelle automatisée bureau et mobile
reste à effectuer dès qu’un navigateur de test ou une prévisualisation privée est disponible.
