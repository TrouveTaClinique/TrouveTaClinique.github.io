/* Worker Cloudflare « aiguillage » : branche la logique (logique.js) sur le SDK officiel
   d'Anthropic, le catalogue publié et les limites de requêtes.
   Secret requis : ANTHROPIC_API_KEY (Cloudflare > Worker > Settings > Variables and Secrets). */
import Anthropic from '@anthropic-ai/sdk';
import { traiter, indexerCatalogue } from './logique.js';

/* Catalogue lu sur le site d'où vient la question (production ou aperçu), gardé 10 minutes. */
const DUREE_CATALOGUE_MS = 10 * 60 * 1000;
const catalogues = new Map(); // origine -> { parUrl, expire }

async function chargerCatalogue(origine) {
  const enCache = catalogues.get(origine);
  if (enCache && enCache.expire > Date.now()) return enCache.parUrl;
  const reponse = await fetch(`${origine}/guides/donnees.json`, { cf: { cacheTtl: 600, cacheEverything: true } });
  if (!reponse.ok) throw new Error(`Catalogue introuvable (${reponse.status})`);
  const parUrl = indexerCatalogue(await reponse.json());
  catalogues.set(origine, { parUrl, expire: Date.now() + DUREE_CATALOGUE_MS });
  return parUrl;
}

/* Erreurs du SDK, de la plus précise à la plus générale. */
function classerErreur(e) {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    console.error('Aiguillage : clé API refusée', e.status);
    return { statut: 503, message: 'Le service d’IA n’est pas configuré correctement. La recherche ci-dessus fonctionne toujours.' };
  }
  if (e instanceof Anthropic.RateLimitError) {
    return { statut: 503, message: 'Le service d’IA est très sollicité. Réessayez dans une minute.' };
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return { statut: 502, message: 'Le service d’IA ne répond pas. Réessayez dans un moment.' };
  }
  if (e instanceof Anthropic.APIError) {
    if (e.status === 402 || e.type === 'billing_error') {
      console.error('Aiguillage : crédits épuisés');
      return { statut: 503, message: 'Le service d’IA a atteint son budget pour le moment. La recherche ci-dessus fonctionne toujours.' };
    }
    console.error('Aiguillage : erreur API', e.status, e.type);
    return { statut: 502, message: 'Le service d’IA a rencontré une erreur. Réessayez dans un moment.' };
  }
  console.error('Aiguillage : erreur interne', e && e.message);
  return { statut: 500, message: 'Erreur interne du service. Réessayez dans un moment.' };
}

export default {
  async fetch(requete, env) {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 40000 });
    return traiter(requete, env, {
      chargerCatalogue,
      appelerModele: params => (params.betas ? client.beta.messages.create(params) : client.messages.create(params)),
      /* Deux limites Cloudflare : par visiteur (adresse IP) et pour l'ensemble du site. */
      limiter: async ip => {
        if (env.LIMITE_VISITEUR && !(await env.LIMITE_VISITEUR.limit({ key: ip })).success) return false;
        if (env.LIMITE_GLOBALE && !(await env.LIMITE_GLOBALE.limit({ key: 'site' })).success) return false;
        return true;
      },
      classerErreur
    });
  }
};
