# Mission 17 : rédaction, français et cohérence

Rapport : `audit-cursor/rapports/17-redaction.md`. Sorties brutes : `rapports/bruts/17-*`.

## Étapes
1. Extrais le texte visible de toutes les pages publiées (version produite par
   `scripts/preparer-pages-production.js` dans un dossier temporaire, ou site en ligne).
2. Orthographe, grammaire, typographie du français du Québec (espaces avant `:`, guillemets
   « », majuscules, abréviations), anglicismes ; aucun tiret cadratin.
3. Terminologie constante : GMF, GMF-U, RLS, PREM, PTEM, PTEM-U (PREM-U), AMP, « Nouveau
   facturant (NF) », noms des établissements et des CISSS, Santé Québec.
4. Années et dates périmées, mentions d'événements passés, promesses non tenues (« bientôt »).
5. Mentions obligatoires selon `CLAUDE.md` : indépendance (accueil, À propos, guides) ;
   adresse `contact@trouvetaclinique.ca` ; nom du propriétaire seulement sur les cartes.
6. Page de confidentialité : correspond-elle à ce que fait vraiment le site (service d'IA,
   Cloudflare, Anthropic, stockage local du navigateur, mesures d'audience, fonds de carte) ?
7. Clarté pour un résident pressé : phrases longues, jargon, informations clés enfouies.

## À rendre
Un tableau « page → texte actuel (court) → correction → fichier source à modifier ».
