/* Test comparatif des modèles de l'aiguillage IA (17 oct. 2026).
   Pose les questions de questions.json comme la page le ferait : même présélection par mots-clés
   (moteur de la page, fiches lues dans les pages générées), même logique que le Worker (traiter,
   catalogueSelonPage, construireRequete), un modèle à la fois. Note chaque réponse selon les
   expressions de questions.json, mesure le délai et le coût, puis écrit resultats.json et
   rapport.md dans resultats/AAAA-MM-JJ-HHMM/ (dossier ignoré par git).

   Clé : variable d'environnement TTC_CLE_TEST, jamais ANTHROPIC_API_KEY (Claude Code s'en
   servirait pour lui-même). Sans clé : --simulation (aucun appel, réponses factices).

   Usage (depuis workers/aiguillage, après npm install) :
     node test/comparaison/comparer-modeles.mjs [--modeles claude-sonnet-5-5,claude-haiku-5-5]
       [--repetitions 1] [--questions q01,q17] [--simulation] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { traiter, indexerCatalogue, catalogueSelonPage } from '../../src/logique.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '../../../..');
const R = createRequire(import.meta.url)(path.join(RACINE, 'assets/guides-recherche.js'));
const ORIGINE = 'https://trouvetaclinique.ca';
const CANDIDATS = 15;   // comme la page (assets/guides-aiguillage.js)

const args = process.argv.slice(2);
const option = (nom, defaut) => {
  const i = args.indexOf('--' + nom);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : defaut;
};
const SIMULATION = args.includes('--simulation');
const MODELES = option('modeles', 'claude-sonnet-5-5,claude-haiku-5-5').split(',').map(s => s.trim()).filter(Boolean);
const REPETITIONS = Math.max(1, Number(option('repetitions', '1')) || 1);
const FILTRE = option('questions', '').split(',').map(s => s.trim()).filter(Boolean);

/* Prix en dollars US par million de jetons (écriture du cache de cinq minutes : 125 %). */
const PRIX = {
  'claude-sonnet-5-5': { entree: 2, sortie: 10, ecritureCache: 2.5, lectureCache: 0.2 },
  'claude-sonnet-5': { entree: 2, sortie: 10, ecritureCache: 2.5, lectureCache: 0.2 },
  'claude-haiku-5-5': { entree: 0.1, sortie: 0.5, ecritureCache: 0.125, lectureCache: 0.01 },
  'claude-opus-5-5': { entree: 4, sortie: 20, ecritureCache: 5, lectureCache: 0.2 }
};

const normaliser = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toLowerCase();
const entites = s => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const donnees = JSON.parse(fs.readFileSync(path.join(RACINE, 'guides/donnees.json'), 'utf8'));
const parUrl = indexerCatalogue(donnees);
const fichePar = new Map(donnees.map(r => [r.url, r]));
const { questions: TOUTES } = JSON.parse(fs.readFileSync(path.join(ICI, 'questions.json'), 'utf8'));
const QUESTIONS = FILTRE.length ? TOUTES.filter(q => FILTRE.includes(q.id)) : TOUTES;

/* Moteur de mots-clés de chaque page, indexé comme dans assets/guides-cliniques.js. */
function moteurDeLaPage(fichier) {
  const html = fs.readFileSync(path.join(RACINE, fichier), 'utf8');
  const debut = html.indexOf('id="guides-catalogue"');
  if (debut < 0) throw new Error(`Catalogue introuvable dans ${fichier}`);
  const fiches = [...html.slice(debut).matchAll(/<li class="guides-resource[^"]*"([^>]*)>/g)].map(m => {
    const attr = {};
    for (const a of m[1].matchAll(/data-([a-z-]+)="([^"]*)"/g)) attr[a[1]] = entites(a[2]);
    return attr;
  });
  const index = fiches.map(f => R.preparer(f.type === 'communautaire'
    ? { titre: f.title + ' ' + (f.ville || ''), organisme: '', categorie: 'Ressources communautaires ' + (f['rubriques-detail'] || ''), motsCles: f.tags, description: f.desc }
    : { titre: f.title, organisme: f.org, categorie: f.category, motsCles: f.tags, description: f.desc, format: f.format }));
  const communautaires = fiches.map(f => f.type === 'communautaire');
  return {
    fiches: fiches.length,
    candidats: (question, n) => R.rechercherParType(index, communautaires, question, { seuil: 0 }).slice(0, n).map(({ i }) => fiches[i].id)
  };
}
const MOTEURS = {
  guides: moteurDeLaPage('guides/index.html'),
  communautaire: moteurDeLaPage('guides/ressources-communautaires/index.html')
};

/* Réponse factice (--simulation) : les trois premiers indices, consommation estimée. */
function simuler(params) {
  const m = /indice seulement\) : ([\d, ]+)/.exec(params.messages[0].content);
  const numeros = m ? m[1].split(',').map(Number).slice(0, 3) : [];
  const taille = params.system.reduce((n, b) => n + b.text.length, 0);
  return {
    model: params.model, stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify({ guides: numeros.map(numero => ({ numero })), lacune: false }) }],
    usage: { input_tokens: 60, cache_creation_input_tokens: Math.round(taille / 3.2), cache_read_input_tokens: 0, output_tokens: 300 }
  };
}

function cout(modele, usage) {
  const p = PRIX[modele];
  if (!p || !usage) return null;
  return ((usage.input_tokens || 0) * p.entree + (usage.cache_creation_input_tokens || 0) * p.ecritureCache
    + (usage.cache_read_input_tokens || 0) * p.lectureCache + (usage.output_tokens || 0) * p.sortie) / 1e6;
}

/* Note : une suggestion est pertinente si son titre ou ses rubriques correspondent à
   l'expression de la question (et au type de fiche ou à la ville exigés, s'il y a lieu). */
function noter(q, guides) {
  const suggestions = guides.map(g => {
    const r = fichePar.get(g.url) || {};
    let ok = !!q.pertinent && new RegExp(q.pertinent).test(normaliser([r.title || g.titre, ...(r.rubriques || [])].join(' ')));
    if (ok && q.format) ok = (r.format || 'guide') === q.format;
    if (ok && q.ville && r.type === 'communautaire' && r.ville) ok = new RegExp(q.ville).test(normaliser(r.ville));
    return { titre: g.titre, url: g.url, type: r.type === 'communautaire' ? 'organisme' : (r.format || 'guide'), ville: r.ville || '', pertinent: ok };
  });
  if (q.vide) return { suggestions, reussi: suggestions.length === 0, premier: null, precision: null };
  const n = suggestions.filter(s => s.pertinent).length;
  return { suggestions, reussi: n > 0, premier: suggestions.length > 0 && suggestions[0].pertinent, precision: suggestions.length ? n / suggestions.length : 0 };
}

async function poser(modele, client, q) {
  const question = q.question;
  const corps = { question, candidats: MOTEURS[q.page].candidats(question, CANDIDATS), page: q.page, communautaire: !!R.estCommunautaire(question) };
  const essai = { brut: null, delai: null, erreur: null };
  const deps = {
    chargerCatalogue: async () => parUrl,
    limiter: async () => true,
    classerErreur: e => { essai.erreur = `${e && e.status ? e.status + ' ' : ''}${e && e.message ? e.message : e}`; return { statut: 502, message: essai.erreur }; },
    appelerModele: async params => {
      const debut = Date.now();
      essai.brut = SIMULATION ? simuler(params)
        : await (params.betas ? client.beta.messages.create(params) : client.messages.create(params));
      essai.delai = Date.now() - debut;
      return essai.brut;
    }
  };
  const requete = new Request('https://aiguillage.test/', {
    method: 'POST', headers: { Origin: ORIGINE, 'Content-Type': 'application/json' }, body: JSON.stringify(corps)
  });
  const reponse = await traiter(requete, { MODELE: modele, ORIGINES: ORIGINE }, deps);
  const resultat = await reponse.json();
  const servi = essai.brut && essai.brut.model ? essai.brut.model : modele;
  return {
    id: q.id, modele, servi, statut: reponse.status, delai: essai.delai,
    usage: essai.brut ? essai.brut.usage : null, cout: essai.brut ? cout(PRIX[servi] ? servi : modele, essai.brut.usage) : null,
    stop: essai.brut ? essai.brut.stop_reason : null, lacune: resultat.lacune === true, refus: resultat.refus === true,
    erreur: resultat.erreur || essai.erreur, indices: corps.candidats.length, communautaire: corps.communautaire,
    ...noter(q, resultat.guides || [])
  };
}

const version = q => catalogueSelonPage([...parUrl.values()], { page: q.page, communautaire: !!R.estCommunautaire(q.question) });
const mediane = v => { const t = v.filter(x => x != null).sort((a, b) => a - b); return t.length ? t[Math.floor((t.length - 1) / 2)] : null; };
const pc = (a, b) => (b ? `${a}/${b} (${Math.round(100 * a / b)} %)` : '-');
const cents = d => (d == null ? '-' : `${(d * 100).toFixed(2).replace('.', ',')} ¢`);
const secondes = ms => (ms == null ? '-' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`);

async function main() {
  const cle = process.env.TTC_CLE_TEST;
  if (!SIMULATION && !cle) {
    console.error('Clé absente : ajouter TTC_CLE_TEST aux variables de l\'environnement (ou lancer avec --simulation).');
    process.exit(1);
  }
  let client = null;
  if (!SIMULATION) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: cle, maxRetries: 4, timeout: 90000 });
  }
  /* Questions de même version du catalogue à la suite : le cache de cinq minutes sert. */
  const ordre = [...QUESTIONS].sort((a, b) => Number(version(b).allege) - Number(version(a).allege));
  const essais = [];
  for (const modele of MODELES) {
    for (let rep = 1; rep <= REPETITIONS; rep++) {
      for (const q of ordre) {
        const e = await poser(modele, client, q);
        essais.push({ ...e, repetition: rep });
        console.log(`${modele} ${q.id} r${rep} : ${q.vide ? (e.reussi ? 'vide, correct' : 'suggestions inattendues') : (e.reussi ? 'pertinent' : 'NON pertinent')} (${secondes(e.delai)}, ${cents(e.cout)})${e.erreur ? ' ERREUR ' + e.erreur : ''}`);
      }
    }
  }

  const bilan = MODELES.map(modele => {
    const de = essais.filter(e => e.modele === modele);
    const notes = de.filter(e => !QUESTIONS.find(q => q.id === e.id).vide);
    const vides = de.filter(e => QUESTIONS.find(q => q.id === e.id).vide);
    const couts = de.map(e => e.cout).filter(c => c != null);
    return {
      modele, essais: de.length,
      reussis: notes.filter(e => e.reussi).length, notes: notes.length,
      premiers: notes.filter(e => e.premier).length,
      precision: notes.length ? notes.reduce((s, e) => s + e.precision, 0) / notes.length : null,
      videsCorrects: vides.filter(e => e.reussi).length, vides: vides.length,
      refus: de.filter(e => e.refus).length, erreurs: de.filter(e => e.erreur).length,
      lacunes: de.filter(e => e.lacune).length,
      delaiMedian: mediane(de.map(e => e.delai)),
      coutTotal: couts.reduce((s, c) => s + c, 0), coutMoyen: couts.length ? couts.reduce((s, c) => s + c, 0) / couts.length : null,
      servis: [...new Set(de.map(e => e.servi))]
    };
  });

  const horodatage = new Date().toLocaleString('sv-SE', { timeZone: 'America/Toronto' }).slice(0, 16).replace(' ', '-').replace(':', '');
  const dossier = path.join(ICI, 'resultats', horodatage + (SIMULATION ? '-simulation' : ''));
  fs.mkdirSync(dossier, { recursive: true });
  const allege = catalogueSelonPage([...parUrl.values()], { page: 'guides', communautaire: false }).catalogue.length;
  fs.writeFileSync(path.join(dossier, 'resultats.json'), JSON.stringify({ date: horodatage, simulation: SIMULATION, modeles: MODELES, repetitions: REPETITIONS, catalogue: { complet: parUrl.size, allege }, bilan, essais }, null, 1));

  const lignes = [
    `# Test comparatif de l'aiguillage IA (${horodatage})${SIMULATION ? ' : SIMULATION, aucun appel réel' : ''}`, '',
    `Catalogue : ${parUrl.size} ressources (version allégée : ${allege}). ${QUESTIONS.length} questions, ${REPETITIONS} passage(s) par modèle.`,
    'Une suggestion est jugée pertinente si son titre ou ses rubriques correspondent à l\'expression prévue pour la question (questions.json).', '',
    '| Modèle | Au moins une suggestion pertinente | Première suggestion pertinente | Précision moyenne | Hors sujet sans suggestion | Lacunes signalées | Refus / erreurs | Délai médian | Coût moyen | Coût total |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...bilan.map(b => `| ${b.modele}${b.servis.some(s => s !== b.modele) ? ` (servi : ${b.servis.join(', ')})` : ''} | ${pc(b.reussis, b.notes)} | ${pc(b.premiers, b.notes)} | ${b.precision == null ? '-' : Math.round(100 * b.precision) + ' %'} | ${pc(b.videsCorrects, b.vides)} | ${b.lacunes} | ${b.refus} / ${b.erreurs} | ${secondes(b.delaiMedian)} | ${cents(b.coutMoyen)} | ${cents(b.coutTotal)} |`),
    '', '## Détail par question', ''
  ];
  for (const q of QUESTIONS) {
    const v = version(q);
    lignes.push(`### ${q.id} · ${q.theme} · page ${q.page === 'guides' ? 'des guides' : 'communautaire'} (catalogue ${v.allege ? 'allégé' : 'complet'})`, '', `> ${q.question}`, '');
    for (const e of essais.filter(x => x.id === q.id)) {
      const liste = e.suggestions.length
        ? e.suggestions.map(s => `${s.pertinent ? '✓' : '✗'} ${s.titre}${s.type === 'organisme' && s.ville ? ` (${s.ville})` : ''}`).join(' · ')
        : '(aucune suggestion)';
      lignes.push(`- **${e.modele}**${REPETITIONS > 1 ? ` r${e.repetition}` : ''} (${secondes(e.delai)}, ${cents(e.cout)}${e.lacune ? ', lacune' : ''}${e.refus ? ', refus' : ''}${e.erreur ? ', erreur : ' + e.erreur : ''}) : ${liste}`);
    }
    lignes.push('');
  }
  fs.writeFileSync(path.join(dossier, 'rapport.md'), lignes.join('\n'));
  console.log('\n' + lignes.slice(5, 7 + bilan.length).join('\n'));
  console.log(`\nRapport : ${path.relative(process.cwd(), path.join(dossier, 'rapport.md'))}`);
}

main().catch(e => { console.error(e); process.exit(1); });
