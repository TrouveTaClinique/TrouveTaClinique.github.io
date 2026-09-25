# Aiguillage IA de la page Guides

Petit service (Cloudflare Worker) derrière la boîte « Demander à l'IA quel guide consulter » de
<https://trouvetaclinique.ca/guides/>. Il n'est pas publié avec le site : GitHub Pages ne copie
jamais le dossier `workers/`.

## Ce qu'il fait

1. La page présélectionne jusqu'à 40 guides avec le moteur de recherche du site
   (`assets/guides-recherche.js`) et les envoie avec la question.
2. Le service ne garde que les adresses présentes dans le catalogue publié
   (`/guides/donnees.json` du site qui pose la question : production ou aperçu).
3. Claude Sonnet 5 choisit au plus 5 de ces guides et donne une raison courte pour chacun.
   Consigne : ne jamais répondre à la question clinique elle-même.
4. Le service renvoie les titres et les liens tirés du catalogue, jamais écrits par l'IA.

Aucune question n'est journalisée ni conservée par le service.

## Coûts et plafond

- Environ 1 ¢ US par question avec Sonnet 5 (lecture d'au plus 40 guides).
- Le plafond est fixé chez Anthropic : crédits prépayés **sans recharge automatique**. Quand ils
  sont épuisés, la boîte affiche « Le service d'IA a atteint son budget » et la recherche
  normale continue de fonctionner.
- Limites de requêtes (voir `wrangler.toml`) : 5 questions par minute par visiteur,
  20 par minute pour l'ensemble du site.
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

`wrangler.toml` : `MODELE` (par défaut `claude-sonnet-5`), `ORIGINES` (sites autorisés) et les
deux limites de requêtes. Une modification poussée sur `main` redéploie le Worker.

## Tests

```bash
cd workers/aiguillage
npm install          # seulement pour test/sdk.test.js (SDK officiel, réseau intercepté)
npm test
```

`test/logique.test.js` ne demande aucune installation ; il tourne aussi dans le workflow
d'aperçu. Aucun test n'appelle la vraie API.
