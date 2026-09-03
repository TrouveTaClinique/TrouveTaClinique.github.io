# Historique du projet

La production est servie depuis `main` sur [trouvetaclinique.ca](https://trouvetaclinique.ca/).
Ce fichier conserve les jalons utiles. Il remplace l’ancien `ETAT-DU-BROUILLON.md`.

## 2 septembre 2026 — premier lot établissements et correctifs pré-merge

- Répertoire `/monteregie-est/etablissements/` en ligne, mais `noindex` jusqu’à la
  publication des 22 fiches (3/22 pour l’instant). Les trois fiches détaillées
  restent indexables.
- Balise `google-site-verification` ajoutée au générateur SEO (`page()`), donc
  présente sur l’accueil et toutes les pages de contenu générées. Les cartes
  l’avaient déjà via `scripts/carte.template.html`. Le fichier
  `google0e6f553795bbb4a9.html` reste à la racine.
- Courriels de recrutement publiés (`PUBLIER_COURRIELS = true`).
- Documents d’entretien alignés sur la production (`README.md`, `LISEZ-MOI.txt`).

## 31 août 2026 — étape 5, archive de clôture du chantier d’architecture

État validé à l’étape 4, conservé ici comme point de reprise historique.

### Fonctionnalités alors en place

- La racine `/` contient la nouvelle page d’accueil.
- La carte générale est générée dans `/monteregie/`.
- Les cartes Est, Centre et Ouest sont générées depuis `scripts/carte.template.html`
  par `scripts/publier-regions.js` (Est : gabarit SQ `scripts/carte-est-sq.template.html`).
- Une couche indépendante « Établissements » publie les établissements disponibles
  dans `data.json`, même s’ils portent encore historiquement `visible: false`.
- Les établissements ont une épingle Santé Québec distincte et une infobulle
  informative. Ils sont exclus des pages de cliniques, de la recherche, des favoris,
  des notes, du classement, du comparatif et de l’export PDF.
- Le thème Santé Québec et le header V4 sont appliqués exclusivement aux quatre cartes.
- Les autres pages munies d’un header utilisent le style sobre bleu marine.
- La PWA, le manifeste et le service worker sont limités à `/monteregie-est/`.
- La page 404 renvoie vers l’accueil.

### Validation alors terminée (étape 4)

Détail dans `RAPPORT-QA-ETAPE-4.md` et `RAPPORT-LIVRAISON-FINALE.md` (rapports
datés du 31 août 2026, conservés pour l’historique).

- Deux régénérations consécutives produisent exactement les mêmes fichiers.
- 127 fiches source traitées à cette date : 89 cliniques publiées, 7 établissements
  cartographiques et 31 fiches hors publication.
- Contrôles HTML, JSON-LD, canoniques, sitemap, JavaScript, CSS, PWA et HTTP local
  réussis.
- L’inspection visuelle automatisée bureau et mobile n’avait pas pu être exécutée
  (archive Chromium tronquée). Cela n’affectait pas les validations de structure.

### Défauts corrigés pendant cette validation

- Deux anciennes URL de cliniques masquées redirigeaient vers une fiche qui
  n’existait plus. Elles renvoient vers le répertoire Montérégie-Est.
- Trois images standard absentes de Leaflet causaient des références CSS brisées.
  Elles sont intégrées dans `leaflet.css`.
- Les commentaires obsolètes du workflow ont été mis à jour.

### Nettoyage de l’étape 3

- Suppression de l’ancien générateur `publier-monteregie-est.js` et du fichier
  intermédiaire `app-pin-est.b64.txt`.
- Les copies régionales PTEM et AMP sont produites par le générateur actuel.
- Clarification du rapport de génération : cliniques publiées, établissements
  cartographiques et fiches hors publication sont comptés séparément.

### Décisions alors laissées ouvertes

- Conserver l’image de partage générique jusqu’à une nouvelle direction explicite.
- Ne pas inventer de mécanisme de formulaire de correction tant que le mode de
  traitement des soumissions n’est pas décidé.
