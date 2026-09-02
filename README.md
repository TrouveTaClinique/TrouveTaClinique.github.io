# Trouve ta clinique

[Voir le brouillon Montérégie-Est](https://trouvetaclinique.github.io/monteregie-est/) · [Accueil du brouillon](https://trouvetaclinique.github.io/)

Ces liens ouvrent l’aperçu de la branche `brouillon`, sans domaine officiel. Attendre la réussite
du workflow « Aperçu du brouillon » après une mise à jour pour voir la nouvelle version.

Site statique consacré aux cliniques en recrutement médical et aux points de repère du réseau
de la santé en Montérégie. Le projet utilise Leaflet, MapLibre et des pages HTML générées depuis
une seule source de données, `data.json`.

> Cette copie est un brouillon de travail. Ne pas la publier sur `main` ou en production sans
> autorisation explicite.

## Architecture publique

| Route | Rôle | Installation |
|---|---|---|
| `/` | Page d'accueil du site | Non |
| `/monteregie/` | Carte complète Est, Centre et Ouest | Non |
| `/monteregie-est/` | Carte dédiée à la Montérégie-Est | PWA et mode hors ligne |
| `/monteregie-centre/` | Carte dédiée à la Montérégie-Centre | Non |
| `/monteregie-ouest/` | Carte dédiée à la Montérégie-Ouest | Non |
| `/cliniques/` | Répertoire général | Non |
| `/ptem/` et `/amp/` | Guides d'information | Non |

Les pages de cliniques et de RLS existent aussi dans chaque univers régional. Les canoniques,
redirections et entrées du sitemap sont fabriqués automatiquement.

## Comportement des cartes

- Par défaut, seules les cliniques en recrutement actif sont affichées.
- L'option « Toutes les cliniques » ajoute les cliniques publiées qui ne recrutent pas
  actuellement.
- Sur les cartes complète, Centre et Ouest, l'option « Établissements » ajoute une couche
  informative indépendante, exclue de la recherche, des favoris, des notes et du comparatif.
- Sur Montérégie-Est, les deux onglets du prototype SQ sont restaurés avec leur fonctionnement
  historique. Le bouton `(i)` remplace le compteur « 7 » et donne la définition d'un établissement.
- Les hôpitaux sont également des repères séparés des cliniques.
- Les favoris, les notes et l'ordre personnalisé restent dans le navigateur avec `localStorage`.

## Sources de vérité

| Fichier | Rôle |
|---|---|
| `data.json` | Données des cliniques, établissements, hôpitaux et annonce |
| `scripts/carte.template.html` | Carte complète, Centre et Ouest; métadonnées communes |
| `scripts/carte-est-sq.template.html` | Prototype SQ Montérégie-Est restauré, CSS original également conservé |
| `scripts/publier-regions.js` | Génération de `/monteregie/` et des trois cartes régionales |
| `scripts/generer-pages-seo.js` | Accueil, répertoires, fiches, pages RLS et sitemap |
| `scripts/slugs.json` | Mémoire permanente des adresses des pages de cliniques |
| `assets/seo-pages.css` | Style des pages web hors cartes |
| `sw.js` | Service worker réservé à la carte Montérégie-Est |
| `manifest-est.webmanifest` | Manifeste de la PWA Montérégie-Est |

Les fichiers `index.html` des cartes et la majorité des pages de contenu sont des sorties
générées. Il faut modifier les gabarits ou `data.json`, puis relancer les générateurs.

## Règles de publication des données

### Cliniques

Une clinique est publiée si :

- son nom est présent;
- `categorie` ne vaut pas `etablissement`;
- `visible` ne vaut pas `false`.

Le champ `recrutementActif: false` ne supprime pas la clinique. Il la réserve à l'option
« Toutes les cliniques » et aux pages publiées à titre de référence.

### Établissements

Une fiche dont `categorie` vaut `etablissement` peut être affichée dans la couche informative
des cartes même si elle porte encore historiquement `visible: false`. Elle ne reçoit jamais de
page SEO de clinique. Dans le prototype Est restauré, elle apparaît dans l'onglet distinct
« Établissements », avec les outils historiques de cet onglet.

### Données sensibles

- Les courriels de recrutement (`personneRessource`) sont publiés sur les fiches (carte et pages
  SEO) depuis le 2 septembre 2026 (`PUBLIER_COURRIELS = true`).
- Le champ `notes` de `data.json` ne doit contenir aucune information destinée au public.
- Aucun montant négocié ni renseignement personnel non autorisé ne doit entrer dans le dépôt.
- Le nom protégé configuré dans le secret GitHub `NOM_PROTEGE_SANTE_QUEBEC` ne doit apparaître
  dans aucun fichier public, y compris les commentaires.

## Génération locale

Prérequis : Node.js. Aucune dépendance npm n'est nécessaire.

```bash
node scripts/generer-pages-seo.js
node scripts/publier-regions.js
```

Le premier script génère l'accueil et les pages de contenu. Le second génère les quatre cartes.
La workflow `.github/workflows/generer-pages-seo.yml` exécute ces opérations et plusieurs garde-fous
à chaque mise à jour pertinente.

Pour tester localement :

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`. L'ouverture directe avec `file://` ne convient pas aux
requêtes `fetch()` ni au service worker.

## PWA Montérégie-Est

La PWA est volontairement limitée à `/monteregie-est/` :

- seul `monteregie-est/index.html` référence `manifest-est.webmanifest`;
- le service worker est enregistré avec la portée `/monteregie-est/`;
- `sw.js` ignore les navigations vers l'accueil, la carte complète, Centre, Ouest et les pages SEO;
- les pages web retirent une ancienne inscription de service worker qui aurait la portée `/`.

Après une modification au contenu mis en cache, augmenter la version dans `sw.js`, par exemple
`trouve-clinique-est-v52` vers `trouve-clinique-est-v53`. Une modification de `data.json` est
chargée en priorité réseau et ne requiert normalement pas ce changement.

Le fichier `manifest.json` est un vestige non référencé de l'ancienne PWA générale. Il est gardé
temporairement pour faciliter la migration des anciennes installations, mais ne doit pas être
utilisé pour une nouvelle page.

## Identité visuelle

- Les quatre cartes conservent le header V4 Santé Québec intégré au gabarit de carte.
- Les autres pages utilisent le header sobre bleu marine avec le logo à gauche de
  « Trouve ta clinique ».
- Les liens de navigation sont définis par le générateur et ne doivent pas être recopiés à la main
  dans les pages générées.
- La police principale est Segoe UI avec des polices système de repli. Aucun service de police
  externe n'est chargé.

## Fichiers à préserver

- `CNAME`, pour le domaine `trouvetaclinique.ca`;
- `google0e6f553795bbb4a9.html`, pour Google Search Console;
- `robots.txt` et `sitemap.xml`;
- `.github/workflows/generer-pages-seo.yml`;
- `scripts/slugs.json`;
- les licences dans `vendor/`.

## Déploiement

Le site de production est servi par GitHub Pages depuis `main`. Cette copie de travail ne doit
pas être poussée sur `main` avant la validation finale et une autorisation explicite. La workflow
refuse notamment une génération invalide, des champs internes (notes, alias), Kaushan Script
dans le thème Est SQ, une PWA hors de Montérégie-Est ou le nom protégé lorsqu'il est configuré.

## Vie privée et services externes

Les notes et favoris restent sur l'appareil. Le fond de carte peut contacter CARTO et
OpenStreetMap. Cloudflare Web Analytics mesure la fréquentation agrégée des cartes et des pages
de contenu. L'application elle-même ne crée aucun compte et ne dépose aucun cookie utilisateur.

## Changement de cycle PTEM

« Trouve ta clinique » est une marque permanente. Lors d'un changement d'année PTEM, mettre à
jour uniquement les étiquettes de cycle :

1. l'écran de chargement et le lien du guide dans `scripts/carte.template.html`;
2. le `short_name` dans `manifest-est.webmanifest`;
3. le titre iOS injecté par `scripts/publier-regions.js`;
4. les contenus factuels des pages PTEM et les sources officielles concernées.

Ne jamais renommer les clés `localStorage` `dtmf-mtg-*`, l'identifiant du manifeste ou le domaine.

## Licence

Voir [LICENSE](LICENSE).
