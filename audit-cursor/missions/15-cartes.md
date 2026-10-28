# Mission 15 : cartes

Rapport : `audit-cursor/rapports/15-cartes.md`. Captures : `rapports/captures/15-*`.

## Pages et sources
`/monteregie-est/`, `/monteregie/` (et `?region=Centre`, `?region=Ouest`),
`/carte-recrutement-est/` ; sources `scripts/carte-est-sq.template.html`,
`scripts/carte.template.html`, `scripts/generer-carte-sq-complete.js`, `scripts/publier-regions.js`.

## Étapes
1. Avec Playwright (hors du dépôt), ordinateur et téléphone : erreurs de la console, nombre de
   marqueurs comparé aux fiches visibles de `data.json`, filtres, recherche, fenêtres
   d'information, bouton de localisation (permission refusée et accordée), menu « i ».
2. Règles du projet (voir `CLAUDE.md`) :
   - carte de l'Est hermétique : aucun lien vers une autre page du site (sauf ce que
     `CLAUDE.md` permet) ; même règle pour la version autonome ;
   - courriels : affichés pour les cliniques et secteurs de l'Est sur la carte de l'Est
     seulement ; sur `/monteregie/`, adresse générale du recrutement pour l'Est ; « À venir »
     pour le Centre et l'Ouest ;
   - crédits : bande d'attribution sur une ligne au téléphone, nom du propriétaire permis sur
     les cartes ; aucun encadré de collaboration ;
   - noms de lieux en français sur le fond vectoriel.
3. Fonds de carte : vectoriel à l'ordinateur, images au téléphone ; que se passe-t-il si le
   fournisseur de tuiles ne répond pas ?
4. Revue du code des gabarits : robustesse si une fiche a un champ manquant, échappement des
   données insérées dans le HTML, taille et lisibilité du gabarit.

## Rappel
Pas de courriel ni de nom de personne dans le rapport.
