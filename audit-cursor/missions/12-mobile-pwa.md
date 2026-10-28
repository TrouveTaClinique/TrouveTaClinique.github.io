# Mission 12 : téléphone, applications installables et hors ligne

Rapport : `audit-cursor/rapports/12-mobile-pwa.md`. Captures : `rapports/captures/12-*`.

## Étapes
1. Avec Playwright (hors du dépôt), ouvre chaque page de `audit-cursor/PAGES.md` en 320, 360,
   390, 414, 768 et 1024 px : défilement horizontal, chevauchements, textes coupés, boutons
   trop petits, éléments fixes qui cachent le contenu. Captures dans `rapports/captures/`.
2. Cartes au téléphone : fond en images sous 860 px, effet aimant entre la carte et le
   répertoire (`repertoire-aimant`, défilement), localisation, fenêtres d'information.
3. Deux applications installables : `/monteregie-est/` (`sw.js`, `manifest-est.webmanifest`)
   et « Guides » (`guides/sw.js`, `guides/manifest.webmanifest`) ; aussi `manifest.json`.
   Manifestes valides, icônes, portée, page de départ ; stratégie de cache de chaque service
   worker, version de cache, mise à jour (une personne qui a installé l'app voit-elle la
   nouvelle version ?), comportement hors ligne (coupe le réseau dans Playwright).
4. Risques : données périmées servies hors ligne, pages qui restent en cache après une
   correction, mélange entre les deux applications.

## À rendre
Le rapport habituel, avec les captures citées par leur nom de fichier.
