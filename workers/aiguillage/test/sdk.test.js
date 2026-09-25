// Parcours complet du Worker avec le vrai SDK d'Anthropic, réseau intercepté :
// aucune requête ne sort, aucune clé réelle n'est utilisée. Nécessite « npm install ».
import test from 'node:test';
import assert from 'node:assert/strict';

let worker = null;
try { worker = (await import('../src/index.js')).default; } catch (e) { /* SDK non installé */ }

const ORIGINE = 'https://trouvetaclinique.ca';
const CATALOGUE = [
  { title: 'Otite moyenne aiguë', org: 'INESSS', cat: 'Infections', tags: 'otite enfant', url: 'https://exemple.ca/otite' },
  { title: 'Allergie aux pénicillines', org: 'INESSS', cat: 'Infections', tags: 'allergie', url: 'https://exemple.ca/allergie' }
];

function intercepter(reponseApi, statutApi = 200) {
  const appels = [];
  globalThis.fetch = async (entree, init = {}) => {
    const url = typeof entree === 'string' ? entree : entree.url;
    if (url === `${ORIGINE}/guides/donnees.json`) return new Response(JSON.stringify(CATALOGUE), { headers: { 'Content-Type': 'application/json' } });
    const entetes = new Headers(init.headers || (entree.headers ?? {}));
    appels.push({ url, entetes, corps: JSON.parse(init.body ?? (await entree.text())) });
    return new Response(JSON.stringify(reponseApi), { status: statutApi, headers: { 'Content-Type': 'application/json', 'request-id': 'req_test' } });
  };
  return appels;
}

const MESSAGE = {
  id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-sonnet-5', stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify({ guides: [{ numero: 1, raison: 'Évalue l’allergie.' }, { numero: 0, raison: 'Traitement de l’otite.' }], message: '' }) }],
  usage: { input_tokens: 900, output_tokens: 80 }
};

const question = candidats => new Request('https://aiguillage.exemple.workers.dev/', {
  method: 'POST',
  headers: { Origin: ORIGINE, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' },
  body: JSON.stringify({ question: 'otite chez un enfant allergique', candidats })
});
const ENV = { ANTHROPIC_API_KEY: 'sk-test', MODELE: 'claude-sonnet-5', LIMITE_VISITEUR: { limit: async () => ({ success: true }) } };

test('Sonnet 5 : requête envoyée au bon point d’accès, réponse traduite', { skip: !worker && 'SDK non installé' }, async () => {
  const appels = intercepter(MESSAGE);
  const r = await worker.fetch(question(CATALOGUE.map(g => g.url)), ENV);
  assert.equal(r.status, 200);
  const corps = await r.json();
  assert.deepEqual(corps.guides.map(g => g.titre), ['Allergie aux pénicillines', 'Otite moyenne aiguë']);
  assert.equal(appels.length, 1);
  assert.match(appels[0].url, /^https:\/\/api\.anthropic\.com\/v1\/messages$/);
  assert.equal(appels[0].entetes.get('x-api-key'), 'sk-test');
  assert.equal(appels[0].corps.model, 'claude-sonnet-5');
  assert.equal(appels[0].corps.output_config.format.type, 'json_schema');
  assert.equal(appels[0].corps.output_config.effort, 'medium');
  assert.equal(appels[0].corps.fallbacks, undefined);
  /* Catalogue complet dans le prompt système, mis en cache une heure. */
  assert.deepEqual(appels[0].corps.system[1].cache_control, { type: 'ephemeral', ttl: '1h' });
  assert.match(appels[0].corps.system[1].text, /\n1 \| Allergie aux pénicillines \| INESSS/);
});

test('Opus 5 : repli automatique par l’en-tête bêta, pas dans le corps', { skip: !worker && 'SDK non installé' }, async () => {
  const appels = intercepter({ ...MESSAGE, model: 'claude-opus-5' });
  const r = await worker.fetch(question([CATALOGUE[0].url]), { ...ENV, MODELE: 'claude-opus-5' });
  assert.equal(r.status, 200);
  assert.match(appels[0].url, /\/v1\/messages\?beta=true$/);
  assert.match(appels[0].entetes.get('anthropic-beta'), /server-side-fallback-2026-07-01/);
  assert.equal(appels[0].corps.fallbacks, 'default');
  assert.equal(appels[0].corps.betas, undefined);
});

test('crédits épuisés : message clair, la page reste utilisable', { skip: !worker && 'SDK non installé' }, async () => {
  intercepter({ type: 'error', error: { type: 'billing_error', message: 'Your credit balance is too low.' } }, 402);
  const r = await worker.fetch(question([CATALOGUE[0].url]), ENV);
  assert.equal(r.status, 503);
  assert.match((await r.json()).erreur, /budget/);
});

test('clé API refusée : message de configuration', { skip: !worker && 'SDK non installé' }, async () => {
  intercepter({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401);
  const r = await worker.fetch(question([CATALOGUE[0].url]), ENV);
  assert.equal(r.status, 503);
  assert.match((await r.json()).erreur, /configuré/);
});
