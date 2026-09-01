# État du brouillon au 31 août 2026 — étape 5, archive finale prête

Ce fichier est le point de reprise officiel du projet. Le projet demeure un brouillon et ne doit
pas être publié sur `main` ni en production sans autorisation explicite.

## Fonctionnalités terminées

- La racine `/` contient la nouvelle page d’accueil.
- La carte générale est générée dans `/monteregie/`.
- Les cartes Est, Centre et Ouest sont générées depuis `scripts/carte.template.html` par
  `scripts/publier-regions.js`.
- Une couche indépendante « Établissements » publie les 7 établissements disponibles dans
  `data.json`, même s’ils portent encore historiquement `visible: false`.
- Les établissements ont une épingle Santé Québec distincte et une infobulle informative.
- Ils sont exclus des pages de cliniques, de la recherche, des favoris, des notes, du classement,
  du comparatif et de l’export PDF.
- Leur affichage est désactivé par défaut et indépendant du recrutement.
- Le libellé affiche simplement « Établissements », sans compteur. Un bouton `(i)` explique au
  survol, au clavier et au toucher ce qu’est un établissement.
- Le thème Santé Québec et le header V4 sont appliqués exclusivement aux quatre cartes.
- Les 108 autres pages munies d’un header utilisent le style sobre bleu marine, avec le logo
  officiel à gauche de « Trouve ta clinique » et les liens convenus conservés.
- La PWA, le manifeste et le service worker sont limités à `/monteregie-est/`.
- La page 404 renvoie vers l’accueil.

## Validation terminée à l’étape 4

- Deux régénérations consécutives produisent exactement les mêmes fichiers.
- 127 fiches source ont été traitées : 89 cliniques publiées, 7 établissements cartographiques
  et 31 fiches hors publication.
- 225 fichiers HTML, 2 427 références locales, 112 blocs JSON-LD, 224 canoniques et 71 URL du
  sitemap ont été validés.
- 10 fichiers JavaScript, 1 fichier Apps Script et 111 blocs JavaScript inline uniques ont été
  compilés sans erreur de syntaxe.
- Les 3 feuilles CSS, les fichiers JSON, le manifeste, le sitemap XML et le workflow YAML sont
  valides.
- Les 108 headers sobres et les 4 headers V4 ont été contrôlés séparément.
- Les 217 pages publiques ciblées ne contiennent aucun courriel ni champ interne interdit.
- La PWA Est contient 19 ressources hors ligne valides et aucune autre carte ne référence un
  manifeste.
- Douze routes essentielles répondent correctement en HTTP local.

## Défauts corrigés pendant la validation

- Deux anciennes URL de cliniques masquées redirigeaient vers une fiche qui n’existait plus.
  Elles renvoient maintenant vers le répertoire Montérégie-Est.
- Trois images standard absentes de Leaflet causaient des références CSS brisées. Elles sont
  maintenant intégrées directement dans `leaflet.css`.
- Les commentaires obsolètes du workflow ont été mis à jour selon l’architecture actuelle.

## Limite connue

L’inspection visuelle automatisée bureau et mobile n’a pas pu être exécutée : le serveur de
téléchargement a retourné une archive Chromium tronquée lors de chaque tentative. Cette limite
n’affecte pas les validations de structure, de liens, de syntaxe, de SEO ou de PWA ci-dessus.

## Livraison finale du brouillon

- L’archive finale du brouillon est prête.
- Le rapport de livraison final est inclus dans `RAPPORT-LIVRAISON-FINALE.md`.
- Le nouveau repo `TrouveTaClinique/TrouveTaClinique.github.io` a été vérifié en lecture seule.
- Il est actuellement vide : aucune branche et aucun commit n’existent encore.
- Aucun fichier n’a été envoyé sur GitHub et `main` n’a jamais été modifiée.

## Action nécessaire avant le dépôt GitHub

La version officielle actuelle doit d’abord être importée dans `main` par le propriétaire du repo.
Cette opération donnera un point de départ réel à la branche `brouillon` et préservera la règle
interdisant de modifier `main` sans autorisation. Le secret de protection exigé par le workflow
doit également être configuré dans le nouveau repo sans jamais être ajouté aux fichiers.

Une fois ces deux préparatifs terminés, le projet de cette archive pourra être déposé uniquement
sur `brouillon`, puis contrôlé avant toute décision concernant la production.

## Nettoyage terminé à l’étape 3

- Suppression de l’ancien générateur `publier-monteregie-est.js`.
- Suppression de l’ancien fichier intermédiaire `app-pin-est.b64.txt`.
- Suppression de l’ancienne fonction de copie devenue inutile; les copies régionales PTEM et AMP
  sont maintenant produites par le générateur actuel.
- Correction des commentaires qui situaient encore la carte générale à la racine.
- Réécriture de `README.md` et de `LISEZ-MOI.txt` selon l’architecture actuelle.
- Clarification du rapport de génération : cliniques publiées, établissements cartographiques
  et fiches hors publication sont comptés séparément.

## Décisions laissées ouvertes

- Conserver l’image de partage générique actuelle jusqu’à une nouvelle direction explicite.
- Ne pas inventer de mécanisme de formulaire de correction tant que le mode de traitement des
  soumissions n’est pas décidé.
