# Mission 14 : référencement, données structurées et liens internes

Rapport : `audit-cursor/rapports/14-seo.md`. Sorties brutes : `rapports/bruts/14-*`.

## Étapes
1. Parcours poli (une requête par seconde) de toutes les adresses de
   https://trouvetaclinique.ca/sitemap.xml et des liens internes trouvés : code HTTP,
   redirections, `canonical`, `title` (longueur, doublons), `meta description`, `h1`, `robots`
   (noindex), Open Graph, langue.
2. Liens internes brisés ou qui redirigent ; pages orphelines (publiées mais liées nulle part) ;
   pages liées mais absentes du plan du site.
3. Données structurées (JSON-LD) : syntaxe et types schema.org de chaque gabarit (accueil,
   fiches, vidéo `VideoObject`, catalogue `CollectionPage`…) ; teste quelques pages avec
   https://validator.schema.org/ (adresse publique seulement).
4. Règles du projet : `/carte-recrutement-est/` en noindex et absente du plan ;
   `/carte-interactive/` renvoie vers `/monteregie/` ; dates `lastmod` cohérentes
   (`scripts/lastmod.json`) ; `robots.txt` ; `llms.txt` ; fichier de clé IndexNow ; page 404.
5. Contenu mince ou dupliqué : fiches presque vides, titres identiques, textes répétés entre
   régions.
6. Propose les corrections dans les sources (script ou gabarit), jamais dans les pages générées.
