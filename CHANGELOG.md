# Historique du projet

La production est servie depuis `main` sur [trouvetaclinique.ca](https://trouvetaclinique.ca/).
Ce fichier conserve les jalons utiles. Les archives datées (31 août et étape 4) sont dans `docs/archives/`.

## 28 septembre 2026 : audit complet

- Vidéo de la carte Est liée depuis l'accueil, le pied de page commun et le menu « i » de la carte ;
  12 chapitres cliquables, balises Clip et extension vidéo du plan du site.
- Fiches : encadré « Vous êtes un patient ? » (811, option 3, et guichet d'accès à un médecin de
  famille), présentation du milieu sans répétition du premier paragraphe.
- Polices des cartes Montérégie, Centre et Ouest hébergées dans `assets/polices/` (plus de Google Fonts).
- Aiguillage IA : plafond quotidien de 150 questions (espace KV Cloudflare à relier dans `wrangler.toml`).
- Accessibilité des cartes Centre et Ouest (boutons RLS, bouton « i » de 24 px) ; HTML valide sur
  les 272 pages générées ; horaires uniformisés ; descriptions des pages Guides raccourcies.
- Archives déplacées dans `docs/archives/` ; historique du cache de la carte Est déplacé ici.

## 25 au 27 septembre 2026 : guides cliniques, IA et carte Est

- Catalogue `/guides/` : guides de pratique, algorithmes, documents pour les patients, favoris,
  moteur de recherche (synonymes, fautes, phrases complètes), filtres Sujet et Organisme,
  application installable et vérification hebdomadaire des liens.
- `/guides/ressources-communautaires/` : organismes communautaires de la Montérégie-Est par type
  d'aide et par ville.
- Aiguillage IA (Worker Cloudflare, Claude Sonnet 5) : suggère des ressources du catalogue, sans
  répondre à la question clinique.
- Carte Est : annonce des portes ouvertes du GMF-U des Montérégiennes, encadré « Réalisé en
  collaboration avec », mode sombre de la barre latérale, retour à la vue d'ouverture à la
  fermeture d'une fiche, fond de carte chargé après les épingles.
- Fiches : encadré « Vous travaillez dans ce milieu ? » ; notes internes vidées et interdites
  dans `data.json` (deux garde-fous).
- Vidéo promotionnelle (4 min) sur `/monteregie-est/video/`, version 6 avec bruitages.
- Robot « Pages production » (liste blanche des fichiers publics), clé IndexNow, liens morts corrigés.

## 2 septembre 2026 : premier lot établissements et correctifs pré-merge

- Répertoire `/monteregie-est/etablissements/` en ligne, mais `noindex` jusqu’à la
  publication des 22 fiches (3/22 pour l’instant). Les trois fiches détaillées
  restent indexables.
- Balise `google-site-verification` ajoutée au générateur SEO (`page()`), donc
  présente sur l’accueil et toutes les pages de contenu générées. Les cartes
  l’avaient déjà via `scripts/carte.template.html`. Le fichier
  `google0e6f553795bbb4a9.html` reste à la racine.
- Courriels de recrutement publiés (`PUBLIER_COURRIELS = true`).
- Documents d’entretien alignés sur la production (`README.md`, `LISEZ-MOI.txt`).

## 31 août 2026 : étape 5, archive de clôture du chantier d’architecture

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

Détail dans `docs/archives/RAPPORT-QA-ETAPE-4.md` et `docs/archives/RAPPORT-LIVRAISON-FINALE.md` (rapports
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

## Cache de la carte Est (`sw.js`)

Une ligne par version de `CACHE`, de la plus ancienne à la plus récente.

- v52 (31 août 2026) : retrait du mode hors ligne des cartes générale, Centre et Ouest; ajout de la couche Établissements et migration de la carte complète vers /monteregie/.
- v53-sq-restaure (1 septembre 2026) : reprise du prototype SQ et du bouton d'information.
- v54-secteurs-etablissements (2 septembre 2026) : couche data-etablissements.json pour l'onglet Établissements.
- v56-fiche-installation (2 septembre 2026) : fiche centrée sur l'installation avec accordéon de secteurs, sélection multiple d'activités, territoires en une ligne défilante.
- v57-rls-contour (3 septembre 2026) : boutons RLS établissements en contour, une ligne sans défilement ; libellé de type mint sur le thème Est.
- v58-territoire-repli (3 septembre 2026) : boutons RLS établissements pleins par défaut, bloc Territoire replié, compteur « X secteurs dans Y installations » retiré.
- v59-hopitaux-h (3 septembre 2026) : goutte H rouge pour les 3 hôpitaux ; numéros d'identification 1–n sur les autres repères établissements.
- v60-pins-cliniques (3 septembre 2026) : gouttes cliniques 24/32 px, regroupement par proximité écran aussi en mode cliniques.
- v61-panneau-scroll (3 septembre 2026) : bulle i établissements retirée ; tête du panneau fixe, liste et secteurs d'activité défilent ensemble.
- v62-territoire-fixe (3 septembre 2026) : les 4 boutons de territoire restent visibles, sans sous-titre ni repli.
- v63-sante-quebec (4 septembre 2026) : dénomination « Santé Québec Montérégie-Est » partout et renommage de l'identifiant des territoires dans territoires-monteregie.js (ressource en cache).
- v64-accueil-fraiche (4 septembre 2026) : auto-destruction de l'ancien enregistrement de portée « / », qui servait encore une page d'accueil périmée au premier chargement.
- v65-seo-meta (4 septembre 2026) : lang fr-CA, noindex de /monteregie/, OG 1200×630, meta Search Console retirée des cartes (conservée sur l’accueil).
- v67-icones-blanc (8 septembre 2026) : icônes d’installation fond blanc, depuis le pin 512.
- 18 sept 2026 : thème aperçu (header/footer/héros, palette marque).
- v71-hero-guide-gutter (18 septembre 2026) : plus de double gutter sur .hero-guide (main porte déjà le padding-inline).
- v72-site-polish (18 septembre 2026) : logo haute définition, recherche rapide restaurée, accueil repoli et vidéo déplacée du répertoire Cliniques vers Établissements.
- v73-logo-officiel-hd (18 septembre 2026) : logo et icônes depuis la source officielle HD sur fond blanc ; cache des assets marque à rafraîchir.
- v74-logo-source (18 septembre 2026) : nouvelle source logo officielle (fond noir → blanc).
- v75-logo-footer-blanc (18 septembre 2026) : logo transparent + invert footer (silhouette blanche).
- v76-largeur-sources (18 septembre 2026) : largeurs pages + boutons Source discrets.
- v77-colonne-elargie (18 septembre 2026) : colonne contenu ~72rem (gutter 36rem).
- v78-rappel-apropos (18 septembre 2026) : largeur encadrés accueil + texte À propos.
- v79-colonne-62rem (18 septembre 2026) : colonne contenu ~62rem ; héros toujours plein écran.
- v80-hero-colonne (18 septembre 2026) : héros aligné sur la même largeur que le reste du site.
- v81-recherche-ptem (18 septembre 2026) : puce PTEM → page guide ; libellé « Parcourez directement ».
- v82-rls-est-vert (18 septembre 2026) : pastilles RLS Montérégie-Est en vert.
- v84-projection-etablissements (20 septembre 2026) : /data-etablissements.json ne sert plus que la projection publique (courriels des responsables retirés selon la politique du fichier). L'URL reste dans CORE : même chemin, mêmes champs publics, la carte est inchangée. Le cache doit être renouvelé pour que les anciennes copies du JSON brut soient supprimées.
- v86-design-cadre (20 septembre 2026) : bandeau plus lisible, cadre 1400 px, section carte commune, guides PTEM/AMP.
- v88-interface : sommaires, pied de page, recherche et favicon transparent.
- v89-guides-theme : catalogue clinique raccordé au thème et aux composants communs.
- v90-guides-favoris : favoris du catalogue clinique (étoile, section « Mes favoris »).
- v91-guides-recherche : moteur de recherche du catalogue (synonymes, fautes, pertinence) et filtres Sujet/Organisme.
- v92-guides-aiguillage : recherche en phrase complète (pertinence, concepts) et boîte d'aiguillage IA.
- v93-icones-transparentes (26 septembre 2026) : favicons et icônes « any » sans carré blanc (les icônes maskable et apple-touch gardent leur fond blanc).
- v94-fond-differe (26 septembre 2026) : moteur MapLibre chargé après les épingles.
- v95-collab-sombre (27 septembre 2026) : encadré de collaboration sombre en mode sombre.
- v96-barre-sombre (27 septembre 2026) : barre latérale sombre en mode sombre.
- v97-sans-legende (27 septembre 2026) : légende des RLS retirée ; encadré de collaboration plus large au cellulaire.
- v98-retour-fiche (27 septembre 2026) : fermer une fiche ramène la vue d'ouverture sur ordinateur.
- v99-audit (28 septembre 2026) : lot de l'audit du 28 septembre (vidéo liée, préconnexion du fond de carte, horaires, HTML valide).
- v100-fond-images (28 septembre 2026) : fond de carte en images au cellulaire (sans moteur vectoriel), choix du propriétaire.
