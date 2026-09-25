/* Moteur de recherche du catalogue clinique (/guides/).
   Chargé tel quel par la page et par scripts/test-recherche-guides.cjs.
   - Synonymes et abréviations (MPOC = BPCO = COPD, FA = fibrillation auriculaire…).
   - Tolérance au pluriel et aux fautes de frappe (distance d'édition 1, ou 2 sur les mots longs).
   - Abréviations courtes (3 lettres ou moins) : mot entier seulement, donc « FA » ne trouve pas « famille ».
   - Pertinence : titre avant organisme, catégorie, mots-clés, puis description. */
(function (racine) {
  'use strict';

  const MOTS_VIDES = new Set(['a', 'au', 'aux', 'avec', 'chez', 'd', 'de', 'des', 'du', 'en', 'et', 'l', 'la', 'le', 'les', 'ou', 'par', 'pour', 'sur', 'un', 'une', 'the', 'of', 'and', 'in', 'for']);

  /* Chaque groupe réunit des expressions équivalentes. Écrire sans accents, en minuscules. */
  const GROUPES = [
    ['mpoc', 'bpco', 'copd', 'maladie pulmonaire obstructive chronique', 'emphyseme'],
    ['fa', 'fibrillation auriculaire', 'fibrillation atriale', 'atrial fibrillation'],
    ['tvp', 'thrombose veineuse profonde', 'dvt', 'deep vein thrombosis', 'phlebite'],
    ['ep', 'embolie pulmonaire', 'pulmonary embolism'],
    ['tev', 'thromboembolie veineuse', 'vte'],
    ['ic', 'icc', 'insuffisance cardiaque', 'heart failure'],
    ['hta', 'hypertension', 'hypertension arterielle', 'haute pression', 'pression arterielle'],
    ['itss', 'its', 'ist', 'mts', 'infections transmissibles sexuellement', 'sti', 'std'],
    ['ivu', 'infection urinaire', 'cystite', 'pyelonephrite', 'uti'],
    ['oma', 'otite moyenne aigue', 'otite'],
    ['tdah', 'tda', 'adhd', 'deficit de l attention'],
    ['tcc', 'tccl', 'traumatisme craniocerebral', 'traumatisme cranio cerebral', 'traumatisme cranien', 'commotion cerebrale', 'commotion'],
    ['sainte justine', 'ste justine', 'chusj', 'hsj', 'chu sainte justine'],
    ['avc', 'accident vasculaire cerebral', 'stroke', 'ait', 'ischemie cerebrale transitoire'],
    ['tnc', 'troubles neurocognitifs', 'trouble neurocognitif', 'demence', 'alzheimer'],
    ['rgo', 'reflux gastro oesophagien', 'reflux', 'gerd'],
    ['aod', 'acod', 'anticoagulants oraux directs', 'doac', 'noac'],
    ['avk', 'warfarine', 'coumadin'],
    ['ains', 'anti inflammatoire', 'anti inflammatoires', 'nsaid'],
    ['ipp', 'inhibiteurs de la pompe a protons', 'inhibiteur de la pompe a protons', 'ppi'],
    ['vih', 'hiv', 'sida'],
    ['amm', 'aide medicale a mourir', 'maid'],
    ['rcr', 'reanimation cardiorespiratoire', 'arret cardiaque'],
    ['sca', 'syndrome coronarien aigu', 'syndrome coronarien', 'infarctus', 'iam', 'idm'],
    ['pac', 'pneumonie acquise en communaute', 'pneumonie'],
    ['grossesse', 'enceinte', 'prenatal', 'pregnancy', 'obstetrique'],
    ['pediatrie', 'pediatrique', 'enfant', 'nourrisson', 'bebe'],
    ['vaccin', 'vaccination', 'immunisation', 'piq'],
    ['lipides', 'cholesterol', 'dyslipidemie', 'statine', 'hypolipemiant'],
    ['depression', 'trouble depressif', 'depressif'],
    ['tb', 'tuberculose', 'tuberculosis'],
    ['gale', 'scabies'],
    ['zona', 'herpes zoster', 'shingles'],
    ['pharyngite', 'amygdalite', 'mal de gorge', 'angine', 'sore throat'],
    ['sinusite', 'rhinosinusite'],
    ['lyme', 'tique'],
    ['diabete', 'diabetes', 'dt2', 'db2'],
    ['ostéoporose', 'osteoporose', 'osteoporosis', 'densite osseuse'],
    ['brue', 'alte', 'malaise grave du nourrisson'],
    ['tsv', 'tachycardie supraventriculaire'],
    ['dka', 'acidocetose'],
    ['epipen', 'anaphylaxie', 'epinephrine', 'adrenaline']
  ];

  function normaliser(texte) {
    return String(texte || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .toLowerCase()
      .replace(/[^a-z0-9%]+/g, ' ')
      .trim();
  }

  /* Pluriel simple : « infections » -> « infection », « aigues » -> « aigue ». */
  function racineMot(mot) {
    if (mot.length > 3 && /[a-z]s$/.test(mot) && !mot.endsWith('ss')) return mot.slice(0, -1);
    if (mot.length > 4 && mot.endsWith('x')) return mot.slice(0, -1);
    return mot;
  }

  function mots(texte) {
    const n = normaliser(texte);
    return n ? n.split(' ').map(racineMot) : [];
  }

  const PHRASES = new Map(); // phrase normalisée -> indice du groupe
  GROUPES.forEach((groupe, i) => groupe.forEach(p => PHRASES.set(mots(p).join(' '), i)));
  const LONGUEUR_MAX = Math.max(...[...PHRASES.keys()].map(p => p.split(' ').length));
  const ALTERNATIVES = GROUPES.map(g => [...new Set(g.map(p => mots(p)))].filter((v, i, t) => t.findIndex(x => x.join(' ') === v.join(' ')) === i));

  /* Distance d'édition (Damerau restreinte), arrêtée tôt au-delà du maximum utile. */
  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let minLigne = Infinity;
      for (let j = 1; j <= b.length; j++) {
        const cout = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cout);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        minLigne = Math.min(minLigne, d[i][j]);
      }
      if (minLigne > max) return max + 1;
    }
    return d[a.length][b.length];
  }

  /* Qualité de correspondance d'un mot de requête avec un mot du document (0 = aucune). */
  function qualiteMot(q, m, dernier, flou) {
    if (q === m) return 1;
    if (q.length <= 3) return 0;                       // abréviation courte : mot entier seulement
    if (m.startsWith(q)) return dernier ? 0.9 : 0.8;   // saisie en cours ou mot tronqué
    const max = !flou ? 0 : q.length >= 8 ? 2 : q.length >= 5 ? 1 : 0;
    if (max && distance(q, m, max) <= max) return 0.6;
    return 0;
  }

  /* Une phrase (suite de mots) se trouve-t-elle dans la liste de mots du champ ? */
  function qualitePhrase(phrase, champ, dernier, flou) {
    let meilleure = 0;
    for (let i = 0; i + phrase.length <= champ.length; i++) {
      let q = 1;
      for (let k = 0; k < phrase.length && q > 0; k++) q = Math.min(q, qualiteMot(phrase[k], champ[i + k], dernier && k === phrase.length - 1, flou));
      if (q > meilleure) meilleure = q;
      if (meilleure === 1) break;
    }
    return meilleure;
  }

  /* Découpe la requête en termes ; chaque terme a une ou plusieurs formulations équivalentes. */
  function analyserRequete(requete) {
    const tokens = mots(requete);
    const utiles = tokens.filter(t => !MOTS_VIDES.has(t));
    const liste = utiles.length ? utiles : tokens;
    const termes = [];
    for (let i = 0; i < liste.length;) {
      let trouve = false;
      for (let n = Math.min(LONGUEUR_MAX, liste.length - i); n >= 1 && !trouve; n--) {
        const phrase = liste.slice(i, i + n).join(' ');
        if (PHRASES.has(phrase)) {
          termes.push({ alternatives: ALTERNATIVES[PHRASES.get(phrase)], saisie: liste.slice(i, i + n), dernier: i + n === liste.length });
          i += n; trouve = true;
        }
      }
      if (!trouve) { termes.push({ alternatives: [[liste[i]]], saisie: [liste[i]], dernier: i === liste.length - 1 }); i++; }
    }
    return termes;
  }

  const POIDS = { titre: 10, organisme: 5, categorie: 4, motsCles: 3, description: 1 };

  function preparer(ressource) {
    const champs = {};
    Object.keys(POIDS).forEach(c => { champs[c] = mots(ressource[c]); });
    return champs;
  }

  /* Score d'une ressource préparée ; 0 si un terme de la requête est absent. */
  function score(champs, termes) {
    let total = 0;
    for (const terme of termes) {
      let meilleur = 0;
      for (const [nom, poids] of Object.entries(POIDS)) {
        for (const alt of terme.alternatives) {
          const exact = alt.join(' ') === terme.saisie.join(' ');
          const q = qualitePhrase(alt, champs[nom], terme.dernier && exact, terme.flou) * (exact ? 1 : 0.9);
          if (q * poids > meilleur) meilleur = q * poids;
        }
        /* Mots tapés tels quels, même quand un synonyme a été reconnu (ex. « ste-justine »). */
        const q2 = qualitePhrase(terme.saisie, champs[nom], terme.dernier, terme.flou);
        if (q2 * poids > meilleur) meilleur = q2 * poids;
      }
      if (!meilleur) return 0;
      total += meilleur;
    }
    return total;
  }

  function rechercher(index, requete) {
    const termes = analyserRequete(requete);
    if (!termes.length) return index.map((r, i) => ({ i, score: 0 }));
    /* Correction des fautes seulement pour un terme introuvable tel quel (« Vouliez-vous dire »),
       sinon « laryngite » ramènerait aussi « pharyngite ». */
    termes.forEach(t => { t.flou = false; t.flou = !index.some(champs => score(champs, [t]) > 0); });
    const resultats = [];
    index.forEach((champs, i) => { const s = score(champs, termes); if (s > 0) resultats.push({ i, score: s }); });
    return resultats.sort((a, b) => b.score - a.score || a.i - b.i);
  }

  const api = { normaliser, mots, analyserRequete, preparer, score, rechercher, distance, GROUPES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else racine.GuidesRecherche = api;
})(typeof window !== 'undefined' ? window : globalThis);
