# Mission 11 : accessibilité (WCAG 2.2, niveau AA)

Rapport : `audit-cursor/rapports/11-accessibilite.md`. Captures : `rapports/captures/11-*`.

## Outils
Playwright et `@axe-core/playwright`, installés dans un dossier temporaire hors du dépôt.
Pages : `audit-cursor/PAGES.md` (site en ligne).

## Étapes
1. axe-core sur chaque page de `PAGES.md`, en largeur ordinateur (1280 px) et téléphone
   (390 px) ; regroupe les violations par règle et par gabarit.
2. Clavier seulement : lien d'évitement, ordre de tabulation, focus visible, pièges au clavier
   (cartes, menus, boîte de dialogue, filtres des guides, favoris), touche Échap.
3. Agrandissement à 200 % et 400 % (refusion sans défilement horizontal), espacement du texte,
   `prefers-reduced-motion`, mode sombre s'il existe.
4. Contrastes : couleurs de la marque, boutons, pastilles, texte sur image, liens.
5. Formulaires : recherche, filtres, boîte « Demander à l'IA » (sans rien envoyer), formulaire
   « Nous joindre » (sans rien envoyer) : étiquettes, messages d'erreur, annonces.
6. Cartes : alternative textuelle (répertoire sous la carte), marqueurs atteignables au clavier,
   fenêtres d'information lisibles par un lecteur d'écran.
7. Structure : `lang`, titres hiérarchisés, repères (`main`, `nav`), textes de liens,
   images et icônes, cibles tactiles d'au moins 24 px.

## À rendre
Le rapport habituel, chaque correction indiquée dans la **source** (gabarit, feuille de style,
script de génération), jamais dans une page générée.
