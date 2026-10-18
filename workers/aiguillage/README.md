# Aiguillage IA de la page Guides

Petit service (Cloudflare Worker) derrière la boîte « Demander à l'IA quel guide consulter » de
<https://trouvetaclinique.ca/guides/>. Il n'est pas publié avec le site : GitHub Pages ne copie
jamais le dossier `workers/`.

## Ce qu'il fait

1. Le service lit le catalogue publié (`/guides/donnees.json` du site qui pose la question :
   production ou aperçu) et le donne à Claude Sonnet 5.5, une ligne par ressource, mis en cache
   cinq minutes chez Anthropic :
   - **en entier** (environ 62 000 jetons au 17 oct. 2026) pour une question communautaire ou
     posée sur la page des ressources communautaires ;
   - **sans les organismes communautaires**, sauf les lignes d'urgence et d'écoute (environ
     44 000 jetons), pour une question clinique de la page des guides : la page envoie
     `communautaire: false` quand son moteur ne juge pas la question communautaire
     (`catalogueSelonPage`, 17 oct. 2026).
2. La page envoie aussi les 15 meilleurs résultats de son moteur de mots-clés
   (`assets/guides-recherche.js`), à titre d'indice seulement : un guide que ce moteur a raté
   (« essoufflement et œdème » pour l'insuffisance cardiaque) reste trouvable.
3. Claude choisit au plus 5 ressources, désignées par leur numéro, et signale une lacune s'il y a
   lieu. Consigne : ne jamais répondre à la question clinique elle-même.
4. Le service renvoie les titres et les liens tirés du catalogue, jamais écrits par l'IA.

Aucune question n'est journalisée ni conservée par le service.

## Coûts et plafond

- Le catalogue fait l'essentiel du coût. Avec Sonnet 5.5 (2 $ US par million de jetons en entrée,
  10 $ en sortie), estimations du 17 oct. 2026 (1 221 ressources) :
  - question isolée (aucune autre dans les cinq minutes précédentes) : environ 12 ¢ US pour une
    question clinique de la page des guides (catalogue allégé), 16 ¢ avec le catalogue complet
    (écriture du cache à 125 % du prix, plus la réponse) ;
  - question qui en suit une autre de moins de cinq minutes : environ 2 ¢ (lecture du cache à
    10 % du prix, plus la réponse).
  Ordre de grandeur : 150 questions isolées pour 20 $, bien davantage si elles se suivent. Chaque
  centaine de guides ajoutée coûte environ 1 ¢ de plus par question isolée. Avant le 17 oct., le
  cache d'une heure (écriture à 200 % du prix) et le catalogue complet portaient une question
  isolée à environ 26 ¢.
- Solde et dépense réelle : console d'Anthropic (<https://platform.claude.com>), section Billing
  pour le solde, pages Usage et Cost pour la dépense de chaque jour.
- Le plafond est fixé chez Anthropic : crédits prépayés **sans recharge automatique**. Quand ils
  sont épuisés, la boîte affiche « Le service d'IA a atteint son budget » et la recherche
  normale continue de fonctionner.
- Limites de requêtes (voir `wrangler.toml`) : 5 questions par minute par visiteur,
  20 par minute pour l'ensemble du site.
- Plafond quotidien (audit P03) : 150 questions par jour pour tout le site (`PLAFOND_JOUR`),
  compté dans un espace KV Cloudflare. Sans ce plafond, un script qui imite l'origine du site
  pourrait vider les 20 $ en moins d'une heure. Mise en place : Cloudflare > Storage & Databases >
  KV > Create (« aiguillage-compteur ») ; copier son identifiant dans le bloc `[[kv_namespaces]]`
  de `wrangler.toml` (retirer les « # ») ; publier sur `main`. Fait le 28 septembre 2026
  (espace « aiguillage-compteur ») : le plafond est actif.
- Cloudflare Workers : gratuit à ce volume.

## Mise en place (une seule fois)

### 1. Compte API Anthropic et plafond de 20 $

1. Ouvrir la console des développeurs d'Anthropic : <https://platform.claude.com>
   (anciennement console.anthropic.com). C'est un compte distinct de l'abonnement Claude Pro.
2. Section **Billing** : acheter 20 $ US de crédits et **désactiver la recharge automatique**
   (auto-reload). Les crédits prépayés sont le plafond absolu.
3. Section **Limits** : fixer, si offert, une limite de dépenses mensuelle de 20 $.
4. Section **API keys** : créer une clé nommée « trouvetaclinique-aiguillage ». La copier
   tout de suite ; elle ne sera plus affichée. Ne jamais la coller dans GitHub ni dans le site.

### 2. Déploiement sur Cloudflare (Workers Builds)

1. Tableau de bord Cloudflare : **Workers & Pages** > **Create** > **Import a repository**.
2. Choisir le dépôt `TrouveTaClinique/TrouveTaClinique.github.io` (autoriser l'application
   GitHub de Cloudflare au besoin).
3. Réglages de construction :
   - **Project name** : `trouvetaclinique-aiguillage` (doit correspondre à `name` dans `wrangler.toml`) ;
   - **Git branch** (production) : `main` ;
   - **Root directory** : `workers/aiguillage` ;
   - commande de déploiement : laisser `npx wrangler deploy`.
4. Lancer le déploiement, puis ouvrir le Worker > **Settings** > **Variables and Secrets** >
   **Add** : type **Secret**, nom `ANTHROPIC_API_KEY`, valeur = la clé de l'étape 1.
5. Noter l'adresse du Worker, de la forme
   `https://trouvetaclinique-aiguillage.<votre-sous-domaine>.workers.dev/`.

### 3. Brancher la page

Inscrire l'adresse du Worker dans `scripts/generer-guides-cliniques.cjs`
(`const URL_AIGUILLAGE = '…';`), régénérer, publier sur `brouillon` et tester sur l'aperçu.
Tant que cette constante est vide, la boîte n'apparaît pas.

## Réglages

`wrangler.toml` : `MODELE` (par défaut `claude-sonnet-5-5`, avec repli automatique côté serveur `fallbacks: "default"`), `ORIGINES` (sites autorisés) et les
deux limites de requêtes. Une modification poussée sur `main` redéploie le Worker.

## Tests

```bash
cd workers/aiguillage
npm install          # seulement pour test/sdk.test.js (SDK officiel, réseau intercepté)
npm test
```

`test/logique.test.js` ne demande aucune installation ; il tourne aussi dans le workflow
d'aperçu. Aucun test n'appelle la vraie API.

## Formulaire « Nous joindre » (route /contact)

La page `/a-propos/` envoie le formulaire à `https://…workers.dev/contact`. Le service valide les
champs (nom et message obligatoires, longueurs limitées, champ piège contre les robots), applique
les mêmes limites de requêtes que l'IA, puis envoie le message par Cloudflare Email Routing. Rien
n'est conservé. Tant que l'envoi n'est pas configuré, il répond 503 « repli » et la page prépare
le courriel dans le logiciel du visiteur.

Prérequis : Cloudflare Email Routing exige que le DNS de `trouvetaclinique.ca` soit chez
Cloudflare. Au 28 septembre 2026, il est chez easyDNS (serveurs de noms et MX easyDNS) : il faut
d'abord y déplacer le DNS, ou bien adapter `envoyer` dans `index.js` pour un service d'envoi
(par exemple Resend, clé API en secret et enregistrements DNS chez easyDNS).

Mise en place (une seule fois, DNS chez Cloudflare) :

1. Cloudflare > zone `trouvetaclinique.ca` > **Email** > **Email Routing** > activer (ajoute les
   enregistrements MX et TXT). Vérifier d'abord qu'aucune autre boîte n'utilise ce domaine.
2. **Destination addresses** : ajouter l'adresse qui recevra les messages et cliquer le lien de
   vérification reçu.
3. Worker > **Settings** > **Variables and Secrets** : secret `CONTACT_DESTINATION` = cette adresse.
4. Retirer les « # » du bloc `[[send_email]]` de `wrangler.toml` et publier sur `main`.
