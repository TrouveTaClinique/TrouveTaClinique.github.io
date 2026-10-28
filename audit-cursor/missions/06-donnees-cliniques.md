# Mission 06 : données des cliniques et des établissements

Rapport : `audit-cursor/rapports/06-donnees-cliniques.md`. Sorties brutes : `rapports/bruts/06-*`.

## Fichiers
`data.json` (clés `miseAJour`, `annonce`, `hopitaux`, `cliniques`), `data-etablissements.json`
(Est), `data-etablissements-centre.json` (Centre), territoires `territoires-monteregie.js`,
`territoires-rls-est.js`, `territoires-rls-centre-ouest.js`.

## Étapes
1. Écris un script de validation dans `rapports/outils-temp/` :
   - champs attendus présents et bien typés, identifiants uniques, doublons (nom, adresse,
     coordonnées) ;
   - coordonnées dans la Montérégie, puis **point dans le polygone** : la clinique tombe-t-elle
     dans le territoire de son RLS (`rls`) et de sa région (`region`) ?
   - téléphones au bon format, adresses web au bon format, villes cohérentes avec l'adresse ;
   - `notes` vide partout ; fiches `visible: false` ; fiches `contactMasque` ;
   - cohérence des champs de recrutement, des niveaux, des horaires et des dates.
2. Vérifie que chaque site web de clinique répond (une requête par seconde au plus) et mène à
   la bonne clinique (titre de la page). Liste les sites brisés, redirigés ou douteux.
3. Établissements : installations, secteurs, responsables, courriels selon les règles de
   `CLAUDE.md` (Est permis dans `data-etablissements.json` seulement ; Centre et Ouest :
   « À venir »).
4. Compare un échantillon de 15 cliniques avec une source publique (site de la clinique, Santé
   Québec, répertoire des GMF) : nom, adresse, téléphone, statut GMF ou GMF-U. Cite la source.
5. Données manquantes qui nuisent à l'usage (fiches presque vides, champs absents en nombre).

## À rendre
Le rapport habituel ; pour les problèmes nombreux, un tableau par identifiant de fiche dans
`rapports/bruts/06-*.md`, sans aucun courriel ni téléphone recopié.
