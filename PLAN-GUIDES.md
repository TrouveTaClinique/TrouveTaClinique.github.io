# Plan de travail : pages Guides et Ressources communautaires

Rédigé le 27 septembre 2026, pour reprendre le travail le 28.
**Rien n'a été publié** : ce fichier et le dossier `plan-guides/` sont sur `brouillon` seulement.
Ils ne font pas partie du site : la liste blanche de `scripts/preparer-apercu.js` les exclut de l'aperçu.

## 0. Pour reprendre

1. `git pull` sur `brouillon`, puis lire ce fichier.
2. Le propriétaire choisit les numéros à réaliser (section 8, « Questions à trancher »).
3. Les données prêtes à utiliser sont dans `plan-guides/` :
   - `guides-proposes.json` : 27 fiches de guides prêtes à coller dans `guides/donnees.json` ;
   - `organismes-pierre-de-saurel.json` : 39 organismes de la MRC de Pierre-De Saurel, plus les 43 membres de la CDC ;
   - `organismes-vallee-du-richelieu.json` : les 103 organismes du répertoire Info SVP, triés (recommandé, optionnel, déjà au catalogue, hors sujet).
4. Règles du catalogue à respecter (voir `CLAUDE.md`) :
   - lien direct vers le guide ou le PDF ;
   - le français d'abord, sinon « (EN) » à la fin du titre ;
   - `cat` = sujet clinique ;
   - `ajoute` = date du jour de l'ajout ;
   - vérifier chaque lien dans un navigateur quand un site refuse les robots.
5. À la fin, supprimer ce fichier et `plan-guides/` de `brouillon` (ou les reporter sur `main`) : sinon la vérification `git diff --quiet brouillon main` échoue.
   On peut aussi vérifier avec `git diff --quiet brouillon main -- . ':!PLAN-GUIDES.md' ':!plan-guides'`.

## 1. Constats du 27 septembre

- **Catalogue :** 347 guides et 302 organismes.
- **Guides par sujet :**
  - le plus fourni : Infections et ITSS (64) ;
  - les plus minces : Hématologie et oncologie (2), Imagerie (2), Pratique professionnelle (3), Soins palliatifs (4), Peau et yeux (6), Santé des femmes (8).
- **Organismes par ville :**
  - Longueuil 99, Saint-Hyacinthe 23, Boucherville 9 ;
  - **Sorel-Tracy 1**, Beloeil 2, Mont-Saint-Hilaire 1.
- **Recherches sans aucun résultat :** endométriose, SOPK, trouble bipolaire, cannabis, chutes (aîné), goutte, polyarthrite, acné, psoriasis, hypothyroïdie, aide médicale à mourir, inaptitude.
- **Recherches qui donnent un mauvais résultat :**
  - « insuffisance rénale chronique » : le transport collectif d'Acton en 2e place (voir 20a) ;
  - « interruption de grossesse » : la dépression pendant la grossesse ;
  - « médecin en détresse » : les ordonnances du CMQ ;
  - « formulaire SAAQ » : le formulaire des niveaux de soins ;
  - « cessation tabagique » : seulement des guides MPOC ;
  - « stérilet » et « anxiété » : un ou deux résultats hors sujet.

## 2. Guides à ajouter (propositions 1 à 16)

Détails complets (titre, organisme, sujet, mots-clés, description) dans `plan-guides/guides-proposes.json`.
État des liens vérifié le 27 septembre :
- « OK » = réponse directe HTTP 200, bon document ;
- « navigateur » = le site refuse les robots (INSPQ, JOGC, canada.ca, pdf du JAMC) : ouvrir le lien à la main avant d'ajouter.

| # | Titre proposé | Organisme | Sujet | Lien |
|---|---|---|---|---|
| 1 | Contraception : Protocole de contraception du Québec (mise à jour 2018) | INSPQ | Santé des femmes | navigateur (lu : 106 p.) |
| 1 | Contraception d'urgence : outil clinique 2024 | INSPQ | Santé des femmes | navigateur |
| 2 | Endométriose : prise en charge clinique (directive no 468) | SOGC | Santé des femmes | navigateur ; trouver la version française |
| 3 | Interruption de grossesse : IVG à l'aide de la pilule abortive | Ordre des pharmaciens | Santé des femmes | OK |
| 4 | Dépistage du cancer du col de l'utérus : protocole médical national (test VPH) | INESSS | Prévention | OK (mai 2025) |
| 5 | Grossesse et petite enfance : Mieux vivre avec notre enfant (2026) | INSPQ | Documents pour les patients | navigateur (PDF de plus de 10 Mo) |
| 6 | Trouble bipolaire : lignes directrices CANMAT/ISBD 2018 (EN) | CANMAT | Santé mentale | OK |
| 6 | Anxiété : lignes directrices canadiennes sur les troubles anxieux (EN) | Anxiety Canada | Santé mentale | OK (texte intégral) |
| 7 | Trouble lié à l'usage d'opioïdes : guide national (mise à jour 2024) | ICRAS (CRISM) | Santé mentale | OK (JAMC, en français) |
| 8 | Cannabis : recommandations canadiennes pour l'usage à moindre risque | Santé Canada | Santé mentale | navigateur (l'ancien PDF de CAMH donne 404) |
| 8 | Alcool : Repères canadiens sur l'alcool et la santé (rapport final) | CCDUS | Santé mentale | OK |
| 8 | Alcool : Repères canadiens (affiche pour les patients) | CCDUS | Documents pour les patients | OK |
| 9 | Cessation tabagique : interventions, y compris le vapotage | INESSS | Santé mentale | OK (déc. 2025) |
| 10 | Santé mentale : Aller mieux à ma façon (outil d'autogestion) | Revivre / CIUSSS EMTL | Documents pour les patients | OK |
| 11 | Aide médicale à mourir : processus décisionnel (fiche) | CMQ | Soins palliatifs | OK |
| 11 | Aide médicale à mourir : lois et critères (fiche) | CMQ | Soins palliatifs | OK |
| 11 | Sédation palliative continue : protocole médical national | INESSS | Soins palliatifs | OK |
| 11 | Sédation en fin de vie : définitions (fiche), optionnel | CMQ | Soins palliatifs | OK |
| 12 | Inaptitude : évaluation médicale (tutelle ou mandat de protection) | Curateur public | Pratique professionnelle | OK (version 2026-06) |
| 12 | Mandat de protection : guide et formulaire | Curateur public | Documents pour les patients | OK |
| 13 | Conduite automobile : évaluation médicale de l'aptitude à conduire (10e éd.) | AMC | Pratique professionnelle | OK (en français, 2024) |
| 13 | Conduite automobile : rapport sur l'état de santé (formulaire SAAQ) | SAAQ | Pratique professionnelle | OK |
| 14 | Chutes chez l'aîné : prévention en communauté | Société québécoise de gériatrie | Gériatrie | OK |
| 14 | Chutes chez l'aîné : dépliant pour les patients, optionnel | INSPQ | Documents pour les patients | navigateur |
| 16 | Thyroïde : bon usage du dosage des hormones thyroïdiennes libres | Choisir avec soin | Cardiovasculaire et métabolique | OK |
| 16 | Obésité chez l'adulte : ligne directrice de pratique clinique | Obésité Canada | Cardiovasculaire et métabolique | OK (JAMC, en français) |
| 15 | Acné : ligne directrice canadienne (EN), optionnel | AMC | Peau et yeux | OK ; chercher une version française |

**Limites constatées :**
- **Aide médicale à mourir :** le guide d'exercice et le protocole médical national de l'INESSS sont réservés aux membres (section sécurisée). On ne peut lier que les fiches publiques du CMQ.
- **Soins palliatifs :** le « Livre de poche de Pallium » est payant, donc exclu.
- **Encore à chercher :**
  - psoriasis ;
  - goutte (piste : outils simplifiés PEER en français dans Le Médecin de famille canadien) ;
  - maladie rénale chronique (le catalogue n'a que la version diabète, en anglais) ;
  - SOPK.
- **Déjà au catalogue (ne pas dupliquer) :**
  - Normes canadiennes pour la lutte antituberculeuse ;
  - obésité : pharmacothérapie 2025 ;
  - contraceptifs hormonaux combinés (fiche 6).

## 3. Ressources communautaires (propositions 17 à 19)

### 17a. MRC de Pierre-De Saurel (Sorel-Tracy) : 33 organismes recommandés

Sources trouvées en ligne :
- **Répertoire des membres de la CDC Pierre-De Saurel** (cdcpds.org, l'ancien domaine cdcpierredesaurel.ca y renvoie) :
  - 43 membres ;
  - nom, adresse, téléphone seulement, sans description ni site web ;
  - la liste est chargée par JavaScript ; elle a été extraite et enregistrée dans `membresCDC` (sans les courriels).
- **Bottin des ressources pour les aînés de la MRC de Pierre-De Saurel (édition 2023, 64 pages)** : https://www.mrcpierredesaurel.com/wp-content/uploads/2023/03/Bottin-des-ressources.pdf
  - descriptions complètes, même format que le bottin du Réseau d'habitations chez soi déjà utilisé ;
  - `sourcePage` = ce PDF avec `#page=N`.
- **211 :** le répertoire PDF de la MRC (211qc.ca/action/211/monteregie-mrc-pierre-de-saurel-fr.pdf) répond 404.

Les coordonnées de 2023 et celles de la CDC (2026) diffèrent parfois ; le fichier le signale (champ `note`) et donne priorité à la CDC.

**Recommandés** (fichier `organismes-pierre-de-saurel.json`, statut A) :

- **Crise et violence :**
  - La Traversée (crise et prévention du suicide, 24/7) ;
  - Maison La Source (femmes victimes de violence) ;
  - Maison Le Passeur (hommes) ;
  - Maison Oxygène (pères et enfants).
- **Dépendances et santé mentale :**
  - Maison La Margelle (thérapie en dépendance et jeu) ;
  - Santé mentale Québec – Pierre-De Saurel ;
  - Groupe d'entraide L'Arrêt-Court ;
  - Le Vaisseau d'Or (familles).
- **Proches aidants et handicap :**
  - AANBR ;
  - Halte-Soleil (répit DI-TSA) ;
  - ADIRS ;
  - Association des personnes handicapées.
- **Maintien à domicile :**
  - Centre d'action bénévole du Bas-Richelieu (transport médical, popote, dépannage) ;
  - Vivre et vieillir chez soi ;
  - Coop d'entretien ménager (EÉSAD) ;
  - programme PAIR.
- **Alimentation :**
  - La Porte du Passant ;
  - Le GESTE ;
  - Carrefour l'Arc-en-Ciel (Saint-Ours) ;
  - Carrefour Saint-Roch-de-Richelieu.
- **Droits et logement :**
  - Action Logement ;
  - ODDS ;
  - Justice alternative (médiation).
- **Maladies chroniques :**
  - Aide Arthrite ;
  - Fibromyalgie ;
  - Sclérose en plaques ;
  - Diabétiques Sorel-Tracy.
- **Aînés et alphabétisation :**
  - RSAPS ;
  - L'Ardoise.
- **Lignes provinciales :**
  - Interligne ;
  - Info-cancer ;
  - Al-Anon ;
  - Conseil pour la protection des malades.

**Optionnels** (statut B) :
- STC (transport adapté, texte à extraire de la page 47) ;
- Carrefour naissance-famille ;
- Au fil des ans ;
- Marché urbain ;
- Récoltes oubliées ;
- Club de marche.

### 17b. Vallée-du-Richelieu : 28 organismes recommandés

Source : répertoire Info SVP de la CDC de la Vallée-du-Richelieu (https://infosvp.ca/repertoire-des-services/).
Chaque organisme a une page complète : adresse, téléphone, site, clientèle, description, services.
Nous n'en avions que 3.

Tri des 103 organismes (fichier `organismes-vallee-du-richelieu.json`) :

| Statut | Nombre | Exemples |
|---|---|---|
| A, recommandé | 28 | Maison Victor-Gadbois (soins palliatifs), Centre périnatal Le Berceau, Grossesse-Secours, Maison de la famille, Bonjour Soleil, Centre de femmes L'Essentielle, Le Phare (proches en santé mentale), Maison de répit L'Intermède, Traumatisés cranio-cérébraux, Prévention des dépendances L'Arc-en-ciel, Mille et une rues, Équijustice Richelieu-Yamaska, Rebâtir, Aide Atout (EÉSAD), Centre de bénévolat Saint-Basile, Le Grain d'Sel, Office régional d'habitation, MEPEC (anglophones), Tel-jeunes, Jeunesse, J'écoute, Interligne, Info-aide violence sexuelle, 1 866 APPELLE, Centre antipoison, Centre d'écoute Montérégie (Chambly, hors territoire) |
| Mise à jour | 1 | « Ligne Aide Abus Aînés » s'appelle maintenant « Ligne Aide Maltraitance Adultes Aînés » (lignemaltraitance.ca) |
| B, optionnel | 22 | friperies et comptoirs, Meublétout, organismes d'emploi, 7 maisons de jeunes, L'Arche, Allergies Québec, Tel-Écoute |
| Déjà au catalogue | 25 | CAB, Parrainage civique, AVRDI/TSA, Contact Richelieu-Yamaska, La Clé sur la porte, JAG, etc. |
| Hors sujet | 27 | municipalités, MRC, député, médias, CLSC, DPJ, OPHQ, SPA, loisirs |

### 18 et 19. Autres organismes et lignes

| Organisme | Coordonnées vérifiées | Remarque |
|---|---|---|
| Maison de soins palliatifs Source Bleue (Boucherville) | 1130, rue de Montbrun ; 450 641-3165 ; maisonsourcebleue.ca (OK) | Admission : dossier médical à admission@maisonsourcebleue.ca |
| Maison Victor-Gadbois (Saint-Mathieu-de-Beloeil) | 1000, rue Chabot ; 450 467-1710 ; maisonvictor-gadbois.com (OK) | Déjà dans 17b |
| La Traversée (Sorel-Tracy) | 450 746-0303 ; cpslatraversee.ca (OK) | Déjà dans 17a |
| PAMQ (Programme d'aide aux médecins du Québec) | 514 397-0888, 1 800 387-4166 ; pamq.org (OK) | Pour les médecins et résidents eux-mêmes : répond à « médecin en détresse » |
| J'Arrête | quebecsanstabac.ca/jarrete (jarrete.qc.ca y renvoie) ; 1 866 527-7383 à confirmer | Utiliser l'adresse finale (pas de redirection) |
| Société Alzheimer Rive-Sud | alzheimerrivesud.ca | Aucun organisme Alzheimer au catalogue ; coordonnées à trouver. Idem pour la Société Alzheimer des Maskoutains–Vallée des Patriotes. |
| Moisson Rive-Sud, Moisson Maskoutaine | moissonrivesud.org, lamoissonmaskoutaine.qc.ca (OK) | Optionnel : ne servent pas le public directement (ils approvisionnent les organismes), donc peu utiles pour diriger un patient. |
| CAVAC | déjà au catalogue (Longueuil) | Rien à faire |

### Changements à prévoir dans le code pour 17 à 19

- **Deux nouvelles rubriques proposées** (les rubriques sont libres, triées par première apparition dans `generer-guides-cliniques.cjs`) :
  - « Soins palliatifs et fin de vie » (Source Bleue, Victor-Gadbois) ;
  - « Grossesse et périnatalité » (Le Berceau, Grossesse-Secours, Matinées Parents-Enfants, Carrefour naissance-famille).
- **`NOTE_COMMUNAUTAIRE`** (`scripts/generer-guides-cliniques.cjs`) : ajouter les nouvelles sources (bottin des aînés de la MRC de Pierre-De Saurel, CDC Pierre-De Saurel, Info SVP) et nommer la région de Sorel-Tracy.
- **`CLAUDE.md`, section Ressources communautaires :** ajouter les mêmes sources.
- **Service worker :** `guides/sw.js`, passer `CACHE` de `ttc-guides-v8` à `v9` (le contenu hors ligne change).
- **Villes :** Sorel-Tracy, Saint-Ours, Saint-Joseph-de-Sorel, Saint-Roch-de-Richelieu, Beloeil, Mont-Saint-Hilaire, Saint-Basile-le-Grand, Saint-Mathieu-de-Beloeil sont en Montérégie-Est.
  - Chambly : « (hors territoire) ».
  - Lignes provinciales : `ville` vide.
- **À surveiller :** 40 fiches ont déjà une `ville` vide (lignes provinciales pour la plupart) ; en vérifier quelques-unes.

## 4. Recherche (propositions 20 à 23)

Fichier : `assets/guides-recherche.js`.
Tests : `scripts/test-recherche-guides.cjs`.
Script de diagnostic utilisé le 27 septembre : pour chaque résultat, le score de chaque mot de la question (fonction `score(index[i], [terme])`).

### 20a. Collision « MRC » (à corriger en premier, avant d'ajouter Sorel et la Vallée)

- **Cause :** le groupe de synonymes de la ligne 83 contient `'mrc'`, pour « maladie rénale chronique ».
  « MRC » veut aussi dire « municipalité régionale de comté ».
  Donc « insuffisance rénale chronique » trouve « Transport collectif de la MRC d'Acton ».
- **Pourquoi c'est urgent :** avec les nouveaux organismes (« MRC de Pierre-De Saurel », « MRC de la Vallée-du-Richelieu »), le problème s'aggravera.
- **Correctif :**
  - retirer `'mrc'` du groupe ;
  - ou n'appliquer le synonyme que si « mrc » n'est pas suivi de « de », « d' » ou « des ».
- **Test à ajouter :** « insuffisance rénale chronique » ne ramène aucun organisme ; « MRC d'Acton » trouve encore le transport d'Acton.

### 20b. Correspondance partielle signalée

- **Cause :**
  - quand un mot précis de la question n'existe nulle part (« interruption », « saaq »), il est écarté et les autres mots décident seuls ;
  - quand aucun document ne couvre tous les mots (« médecin » + « détresse »), chaque résultat n'en couvre qu'un.
- **Correctif proposé :** `rechercher` renvoie aussi la liste des mots absents du catalogue, et si les meilleurs résultats couvrent tous les mots.
  La page affiche alors, au-dessus des résultats : « Aucun guide ne contient « interruption ». Résultats pour « grossesse » seulement. » et un bouton « Demander à l'IA ».
- **Variante plus stricte :** quand au moins un document couvre tous les mots précis, ne garder que ceux-là.
- **Tests :**
  - « interruption de grossesse » signale « interruption » (tant que le guide IVG n'est pas ajouté) ;
  - « otite chez un enfant allergique » ne change pas (les tests actuels doivent passer).

### 21. Synonymes et concepts à ajouter (`GROUPES`, `CONCEPTS`)

- **IVG :** IVG, avortement, interruption de grossesse, interruption volontaire de grossesse, pilule abortive, Mifegymiso.
- **Stérilet :** stérilet, DIU, dispositif intra-utérin, Mirena, Kyleena, Jaydess, stérilet de cuivre.
- **SOPK :** SOPK, syndrome des ovaires polykystiques, ovaires polykystiques, PCOS.
- **AMM :** AMM, aide médicale à mourir, MAID.
  - Attention, AMM = aussi « autorisation de mise en marché » : vérifier qu'aucun guide ne l'emploie dans ce sens.
- **SPC :** SPC, sédation palliative continue.
- **TUO :** TUO, TLUO, trouble lié à l'usage d'opioïdes, dépendance aux opioïdes, buprénorphine, Suboxone, méthadone.
- **TAG :** TAG, trouble d'anxiété généralisée, anxiété, trouble anxieux, trouble panique.
- **Bipolaire :** trouble bipolaire, maladie bipolaire, maniaco-dépression, manie, lithium.
- **Tabac :** tabac, tabagisme, cessation tabagique, arrêt tabagique, cigarette, vapotage, nicotine, J'Arrête.
  - Le concept actuel `fumeur -> mpoc` doit aussi pointer vers « cessation tabagique ».
- **Inaptitude :** inaptitude, mandat de protection, homologation, tutelle, curatelle, régime de protection, Curateur public.
- **Conduite :** SAAQ, permis de conduire, aptitude à conduire, conduite automobile.
- **Chutes :** chute, chutes, prévention des chutes, équilibre, PIED.
- **Acné :** acné, isotrétinoïne, Accutane, Epuris.
- **Thyroïde :** hypothyroïdie, TSH, lévothyroxine, Synthroid, thyroïde.
- **Détresse du médecin :** détresse, épuisement, burnout, santé des médecins, PAMQ.
- **Côté communautaire, à ajouter aussi à l'expression `COMMUNAUTAIRE` :**
  - soins palliatifs / maison de soins palliatifs ;
  - périnatalité / relevailles ;
  - répit ;
  - LGBT / Interligne ;
  - antipoison.

### 22. Quand rien ne correspond

- **Endroit :** dans `assets/guides-cliniques.js`, `render()` affiche déjà le compte et le lien vers l'autre page.
- **Deux boutons sous « Aucun résultat » :**
  - « Demander à l'IA » : copie la requête dans `#guides-ia-question`, fait défiler jusqu'à la boîte IA et la soumet ;
  - « Proposer ce guide » : réutilise `PROPOSITION_HREF` avec le sujet tapé dans le corps du courriel.
- **Test :** vérifier le HTML généré (présence des deux boutons dans le gabarit) ou tester dans Playwright.

### 23. Journal anonyme des recherches sans résultat (plus tard)

- **Côté Worker :** un point `POST /journal` dans `workers/aiguillage`, qui ne reçoit que les mots tapés et la page.
- **Côté page :** l'appel se fait au plus une fois par requête, après 2 secondes sans frappe.
- **Stockage :** Cloudflare KV ou D1, à créer dans le tableau de bord Cloudflare (le propriétaire doit le faire).
- **Hors du compte IA :** ne consomme pas les crédits de Claude.
- **Consultation :** une page privée ou un export hebdomadaire.
- **Vie privée :** avertir dans la page que les mots tapés sans résultat sont conservés anonymement.

## 5. Mise en page (propositions 24 à 30)

| # | Changement | Où | Remarques |
|---|---|---|---|
| 24 | Pastilles de sujets en haut de « Parcourir par sujet », comme la page des établissements (`.es-chip`) | `generer-guides-cliniques.cjs` (`sectionsDe`), CSS `guides-cliniques.css`, JS : clic sur une pastille = ouvrir et faire défiler vers la section | 20 sujets et 25 rubriques : défilement horizontal sur téléphone |
| 25 | Filtre « Type » : guide, algorithme, document pour le patient, formulaire ou outil ; case « Français seulement » (masque les titres « (EN) ») | Nouveau champ `format` dans `donnees.json` (à déduire du titre pour les 347 fiches existantes, puis relire) ; filtres générés comme `data-filtre` | Le plus long : classer 347 fiches. Faire un script de proposition, puis relire à la main |
| 26 | Résumé d'une ligne sous chaque titre (champ `desc`, déjà présent) et petite étiquette « PDF » | `carteGuide()` | Vérifier que les `desc` ne répètent pas le titre ; en réécrire au besoin |
| 27 | Bouton « Partager » sur les documents pour les patients (partage natif du téléphone, sinon copie du lien) et code QR à montrer au patient | `carteGuide()` + `guides-cliniques.js` ; QR : petite bibliothèque locale dans `vendor/`, ou image générée à la génération | Ne pas charger de script externe au démarrage : QR seulement au clic |
| 28 | « Consultés récemment » : les 5 dernières ressources ouvertes, gardées dans le navigateur | `guides-cliniques.js` (même principe que les favoris, clé `ttc-guides-recents`, try/catch) | Section repliée par défaut, sous les favoris |
| 29 | « Signaler un lien brisé » sur chaque fiche (courriel prérempli avec le titre et le lien) | `carteGuide()`, `carteCommunautaire()` | Petit lien discret, pas un bouton |
| 30 | Sur téléphone : barre de recherche collante en haut au défilement et bouton « Haut de page » | CSS `position: sticky` sur `.guides-recherche` ; bouton qui apparaît après 2 écrans | Vérifier que la barre ne cache pas les ancres (`scroll-margin-top`) |

Pour 24 à 30 :
- augmenter la version des ressources (`?v=106-recents` dans `generer-guides-cliniques.cjs`) ;
- augmenter `CACHE` dans `guides/sw.js`.

## 6. Ordre de travail proposé

1. **20a (MRC) et 21 (synonymes)**, avec leurs tests : petit, sans risque, utile tout de suite.
2. **Guides de la section 2 :**
   - ouvrir d'abord dans un navigateur les liens marqués « navigateur » ;
   - chercher les versions françaises manquantes (endométriose, acné) ;
   - ajouter les fiches dans `guides/donnees.json` avec `ajoute` = date du jour ;
   - ajouter aux tests de recherche les requêtes qui ne trouvaient rien (endométriose, bipolaire, cannabis, chutes, AMM, inaptitude, SAAQ, IVG).
3. **Organismes de Sorel (17a), puis de la Vallée (17b), puis 18 et 19 :**
   - mêmes champs que les fiches existantes (`rubrique`, `rubriques`, `ville`, `adresse`, `telephone`, `pourQui`, `heures`, `acces`, `services`, `sourcePage`, `tags`, `desc`) ;
   - site web vérifié sinon lien vers la page source.
4. **20b et 22** (correspondance partielle, boutons « Aucun résultat »).
5. **24, 26, 29, puis 25, 27, 28, 30** selon les choix du propriétaire.
6. **Pour chaque lot :**
   - générer : `node scripts/generer-pages-seo.js` ;
   - tests : `node --test scripts/test-*.cjs workers/aiguillage/test/logique.test.js | grep -q "^# fail 0"` ;
   - `node scripts/verifier-navigation-est.js` ;
   - `node scripts/verifier-fuites-etablissements.js` ;
   - générer une 2e fois et vérifier qu'aucun fichier ne change ;
   - pousser sur `brouillon`.
7. **Publication sur `main` :** seulement quand le propriétaire écrit « publie sur main ».

## 7. Rappels

- Aucun tiret cadratin dans le contenu.
- Titres « Sujet : précision » ; l'ancien titre va dans `tags`.
- Pas de documents internes d'établissement.
  Le protocole de sédation hébergé par le CISSS de Lanaudière a été remplacé par la version de l'INESSS.
- Pas de page qui liste d'autres documents.
  La page « Aide médicale à mourir » du CMQ en est une : on lie les fiches PDF.
- Le Worker d'IA reçoit tout le catalogue : les nouvelles fiches y seront automatiquement (cache d'une heure).

## 8. Questions à trancher avec le propriétaire

1. Quels numéros réaliser (recommandation : 20a, 21, les guides A de la section 2, 17a, 17b statut A, 18 et 19, puis 20b, 22, 24, 26) ?
2. Accepter les deux nouvelles rubriques « Soins palliatifs et fin de vie » et « Grossesse et périnatalité » ?
3. Organismes optionnels (B) : maisons de jeunes, friperies, emploi, oui ou non ?
4. Le PAMQ va-t-il sur la page communautaire (ligne d'aide) ou sur la page Guides (Pratique professionnelle) ?
5. Guides en anglais sans version française (bipolaire, anxiété, acné) : les ajouter avec « (EN) » ?
6. Proposition 23 (journal anonyme) : le propriétaire veut-il créer le stockage Cloudflare ?
