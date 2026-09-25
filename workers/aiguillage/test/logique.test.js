// Logique de l'aiguillage : aucune dépendance, aucun réseau.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  traiter, indexerCatalogue, retenirCandidats, construireRequete, interpreterReponse, listerCatalogue,
  CANDIDATS_MAX, GUIDES_MAX, SCHEMA
} from '../src/logique.js';

const CATALOGUE = Array.from({ length: 60 }, (_, i) => ({
  title: `Guide ${i}`, org: i % 2 ? 'INESSS' : 'CHU Sainte-Justine', cat: 'Catégorie', tags: 'otite enfant', url: `https://exemple.ca/g${i}`
}));
const PAR_URL = indexerCatalogue(CATALOGUE);
const ORIGINE = 'https://trouvetaclinique.ca';
const reponseModele = obj => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(obj) }] });

function requete(corps, { origine = ORIGINE, methode = 'POST' } = {}) {
  return new Request('https://aiguillage.exemple.workers.dev/', {
    method: methode,
    headers: { Origin: origine, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' },
    body: methode === 'POST' ? JSON.stringify(corps) : undefined
  });
}
function deps(extra = {}) {
  const appels = [];
  return {
    appels,
    chargerCatalogue: async () => PAR_URL,
    appelerModele: async params => { appels.push(params); return reponseModele({ guides: [{ numero: 1, raison: 'Couvre le sujet.' }], message: '' }); },
    limiter: async () => true,
    classerErreur: () => ({ statut: 502, message: 'Erreur du service.' }),
    ...extra
  };
}

test('candidats : adresses inconnues, doublons et excédent écartés', () => {
  const urls = ['https://ailleurs.com/x', ...CATALOGUE.map(r => r.url), CATALOGUE[0].url];
  const retenus = retenirCandidats(urls, PAR_URL);
  assert.equal(retenus.length, CANDIDATS_MAX);
  assert.equal(retenus[0].url, CATALOGUE[0].url);
  assert.equal(new Set(retenus.map(g => g.url)).size, retenus.length);
  assert.deepEqual(retenirCandidats('pas une liste', PAR_URL), []);
});

const LISTE = [...PAR_URL.values()];

test('requête Sonnet 5 : catalogue complet mis en cache, présélection en indice, sortie JSON', () => {
  const r = construireRequete({ modele: 'claude-sonnet-5', catalogue: LISTE, indices: [3, 7], question: 'otite' });
  assert.equal(r.model, 'claude-sonnet-5');
  assert.deepEqual(r.output_config, { format: { type: 'json_schema', schema: SCHEMA }, effort: 'medium' });
  assert.equal(r.fallbacks, undefined);
  assert.equal(r.betas, undefined);
  const [consignes, catalogue] = r.system;
  assert.equal(consignes.cache_control, undefined);
  assert.deepEqual(catalogue.cache_control, { type: 'ephemeral', ttl: '1h' });
  assert.match(catalogue.text, /\n3 \| Guide 3 \| INESSS \| Catégorie \| otite enfant/);
  assert.match(catalogue.text, /\n59 \| Guide 59 /);
  assert.match(r.messages[0].content, /^Présélection du moteur de mots-clés \(indice seulement\) : 3, 7\n\n<question>otite<\/question>$/);
});

test('requête : le catalogue ne dépend pas de la question (cache stable)', () => {
  const a = construireRequete({ modele: 'claude-sonnet-5', catalogue: LISTE, indices: [1], question: 'otite' });
  const b = construireRequete({ modele: 'claude-sonnet-5', catalogue: LISTE, indices: [], question: 'autre chose' });
  assert.deepEqual(a.system, b.system);
  assert.match(b.messages[0].content, /rien présélectionné/);
});

test('requête : la page d’origine oriente les types sans toucher au cache', () => {
  const comm = construireRequete({ modele: 'claude-sonnet-5', catalogue: LISTE, indices: [], question: 'faim', page: 'communautaire' });
  const guides = construireRequete({ modele: 'claude-sonnet-5', catalogue: LISTE, indices: [], question: 'faim', page: 'guides' });
  const inconnue = construireRequete({ modele: 'claude-sonnet-5', catalogue: LISTE, indices: [], question: 'faim', page: 'autre' });
  assert.match(comm.messages[0].content, /^La question vient de la page des ressources communautaires/);
  assert.match(guides.messages[0].content, /^La question vient de la page des guides cliniques/);
  assert.match(inconnue.messages[0].content, /^Le moteur de mots-clés/);
  assert.deepEqual(comm.system, guides.system);
});

test('catalogue : ligne propre aux ressources communautaires', () => {
  const liste = [...indexerCatalogue([{ title: 'Abri', url: 'https://a.ca', cat: 'Ressources communautaires', type: 'communautaire', rubriques: ['Hébergement · Femmes'], ville: 'Longueuil', pourQui: '18 ans et plus' }]).values()];
  assert.equal(listerCatalogue(liste), '0 | Abri | Ressource communautaire : Hébergement · Femmes | Longueuil | 18 ans et plus');
});

test('requête Opus 5 : repli automatique ; Haiku 4.5 : sans effort', () => {
  const opus = construireRequete({ modele: 'claude-opus-5', catalogue: LISTE, question: 'x' });
  assert.deepEqual(opus.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(opus.fallbacks, 'default');
  const haiku = construireRequete({ modele: 'claude-haiku-4-5', catalogue: LISTE, question: 'x' });
  assert.equal(haiku.output_config.effort, undefined);
});

test('réponse : seuls les numéros valides, sans doublon, au plus 5', () => {
  const candidats = retenirCandidats(CATALOGUE.slice(0, 10).map(r => r.url), PAR_URL);
  const guides = [99, -1, 1.5, 2, 2, 3, 4, 5, 6, 7].map(numero => ({ numero, raison: ' Raison. ' }));
  const res = interpreterReponse(reponseModele({ guides, message: '' }), candidats);
  assert.equal(res.guides.length, GUIDES_MAX);
  assert.deepEqual(res.guides.map(g => g.titre), ['Guide 2', 'Guide 3', 'Guide 4', 'Guide 5', 'Guide 6']);
  assert.equal(res.guides[0].raison, 'Raison.');
  assert.equal(res.guides[0].url, 'https://exemple.ca/g2');
});

test('réponse : refus, JSON illisible, aucun guide', () => {
  assert.equal(interpreterReponse({ stop_reason: 'refusal', content: [] }, []).guides.length, 0);
  assert.throws(() => interpreterReponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'pas du JSON' }] }, []), /illisible/);
  assert.throws(() => interpreterReponse({ stop_reason: 'max_tokens', content: [] }, []), /incomplète/);
  assert.match(interpreterReponse(reponseModele({ guides: [], message: '' }), []).message, /Aucune ressource/);
});

test('HTTP : origine inconnue refusée, préflight accepté, GET refusé', async () => {
  assert.equal((await traiter(requete({}, { origine: 'https://pirate.exemple' }), {}, deps())).status, 403);
  const pre = await traiter(requete({}, { methode: 'OPTIONS' }), {}, deps());
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('Access-Control-Allow-Origin'), ORIGINE);
  assert.equal((await traiter(requete({}, { methode: 'GET' }), {}, deps())).status, 405);
});

test('HTTP : question trop courte ou trop longue', async () => {
  assert.equal((await traiter(requete({ question: 'a' }), {}, deps())).status, 400);
  assert.equal((await traiter(requete({ question: 'x'.repeat(401) }), {}, deps())).status, 400);
});

test('HTTP : limite de requêtes atteinte', async () => {
  const r = await traiter(requete({ question: 'otite enfant', candidats: [CATALOGUE[0].url] }), {}, deps({ limiter: async () => false }));
  assert.equal(r.status, 429);
});

test('HTTP : sans présélection valide, le modèle cherche quand même dans tout le catalogue', async () => {
  const d = deps();
  const r = await traiter(requete({ question: 'otite enfant', candidats: ['https://ailleurs.com/x'] }), {}, d);
  assert.equal(r.status, 200);
  assert.equal(d.appels.length, 1);
  assert.match(d.appels[0].messages[0].content, /rien présélectionné/);
  assert.deepEqual((await r.json()).guides.map(g => g.titre), ['Guide 1']);
});

test('HTTP : parcours complet, numéros du catalogue complet, titres et liens tirés du catalogue', async () => {
  const d = deps({ appelerModele: async params => { d.appels.push(params); return reponseModele({ guides: [{ numero: 42, raison: 'Couvre le sujet.' }], message: '' }); } });
  const r = await traiter(requete({ question: '  otite   chez un enfant ', candidats: [CATALOGUE[0].url, CATALOGUE[7].url] }), { MODELE: 'claude-sonnet-5' }, d);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGINE);
  const corps = await r.json();
  assert.deepEqual(corps.guides.map(g => [g.titre, g.url]), [['Guide 42', 'https://exemple.ca/g42']]);
  assert.match(d.appels[0].messages[0].content, /indice seulement\) : 0, 7\n\n<question>otite chez un enfant<\/question>/);
});

test('HTTP : erreur du service transmise proprement', async () => {
  const r = await traiter(requete({ question: 'otite enfant', candidats: [CATALOGUE[0].url] }), {}, deps({ appelerModele: async () => { throw new Error('panne'); } }));
  assert.equal(r.status, 502);
  assert.equal((await r.json()).erreur, 'Erreur du service.');
});
