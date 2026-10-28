# Mission 02 : ce qui est publié et confidentialité

Rapport : `audit-cursor/rapports/02-publication-et-confidentialite.md`.

## But
Vérifier, fichier par fichier, que la version publiée ne contient aucune donnée qui ne devrait
pas l'être, et que les garde-fous l'empêcheraient vraiment.

## Étapes
1. Produis la version publiée dans un dossier temporaire hors du dépôt :
   `node scripts/preparer-pages-production.js <dossier temporaire>`.
   Inventaire : nombre de fichiers, taille totale, dix plus gros fichiers, extensions.
2. Contrôle qu'il n'y a ni `.md`, ni script de `scripts/`, ni fichier privé (`*.prive.json`,
   source des établissements), ni `LICENSE`, ni note interne.
3. Dans tous les fichiers texte publiés (HTML, JS, JSON, CSS, manifestes), cherche :
   - les adresses courriel : classe chacune selon les règles de `CLAUDE.md`
     (`contact@trouvetaclinique.ca`, adresses génériques de recrutement des CISSS, courriels des
     cliniques de l'Est dans les données des cartes seulement, courriels des départements dans
     `data-etablissements.json` seulement) ; toute autre est un constat ;
   - les numéros de téléphone dans les textes libres (règle `PUBLIER_TELEPHONES`) ;
   - les champs qui ne doivent pas être publiés : `notes` non vides, `sourceRepertoire`,
     `meta.sourceDocument`, notes de `politiqueAffichage`, `infos` des fiches HRR du Centre,
     fiches `visible: false`, noms des fiches `contactMasque` ;
   - les commentaires internes dans le HTML et le JS publiés (notes de travail, décisions,
     noms de personnes, mentions de documents internes) ;
   - le nom du propriétaire : permis seulement sur les cartes (voir `CLAUDE.md`, crédits).
4. Vérifie la même chose sur le site en ligne pour un échantillon (accueil, deux fiches, les
   deux cartes, `data.json`, `data-etablissements.json`, `guides/donnees.json`) : le fichier en
   ligne doit être identique à celui que produit l'étape 1.
5. Essais des garde-fous, dans une copie temporaire (`git worktree add ../ttc-audit-02 HEAD`) :
   introduis une à une des fuites fictives (courriel inventé `exemple.fictif@exemple.org` dans un
   champ libre de `data.json`, note non vide, téléphone dans un texte libre, courriel dans
   `guides/donnees.json`), lance les tests et les vérifications, et note lesquels détectent la
   fuite. Supprime la copie à la fin.

## Rappel
Aucune donnée réelle dans le rapport : type de donnée et emplacement seulement.
