'use strict';

/*
 * Contrôle bloquant : aucune donnée d'établissement interdite ne sort dans l'artefact publié.
 * ==========================================================================================
 * 20 septembre 2026. Remplace le vérificateur livré le 19 septembre, trop étroit.
 *
 * USAGE
 *   node scripts/verifier-fuites-etablissements.js
 *   node scripts/verifier-fuites-etablissements.js --sortie <repertoire-artefact>
 *   node scripts/verifier-fuites-etablissements.js --sortie <dir> --prive-est <fichier>
 *
 *   --sortie   racine de l'artefact à inspecter (défaut : racine du dépôt).
 *   --prive-est  fichier de travail Est, hors dépôt. Optionnel. Absent en CI.
 *
 * Le journal nomme le fichier, le champ et l'entrée, jamais la valeur privée.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  champsARetirer, politiqueDe, empreinteCourriel
} = require('./projeter-etablissements.js');

const RACINE_DEPOT = path.resolve(__dirname, '..');
const EXTENSIONS_TEXTE = new Set([
  '.html', '.json', '.js', '.cjs', '.mjs', '.txt', '.xml', '.csv', '.svg',
  '.webmanifest', '.md', '.yml', '.yaml', '.css'
]);
const NOMS_PRIVES = /(^|[\\/])data-etablissements[^\\/]*\.prive\.json$/i;
const ARCHIVES_PRIVEES = /(correctifs|prive|privé).*\.(zip|7z)$/i;
const SOURCE_TRAVAIL_ETABLISSEMENTS = /(^|[\\/])donnees-etablissements-source\.json$/i;

const ADRESSES_PUBLIQUES_SITE = new Set([
  'olivier.laplante.med@ssss.gouv.qc.ca',
  'recrutement_omnis.cisssmo16@ssss.gouv.qc.ca'
]);

const MOTIF_COURRIEL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function argsNommes(argv) {
  const out = { sortie: RACINE_DEPOT, priveEst: '', empreintes: '' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sortie' && argv[i + 1]) out.sortie = path.resolve(argv[++i]);
    else if (argv[i] === '--prive-est' && argv[i + 1]) out.priveEst = path.resolve(argv[++i]);
    else if (argv[i] === '--empreintes' && argv[i + 1]) out.empreintes = path.resolve(argv[++i]);
  }
  return out;
}

function relatif(racine, p) {
  return path.relative(racine, p).split(path.sep).join('/');
}

function decoderTexte(texte) {
  return String(texte)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(?:64|x0*40);/gi, '@')
    .replace(/&commat;/gi, '@')
    .replace(/%40/gi, '@')
    .replace(/&#(?:46|x2e);/gi, '.')
    .replace(/&period;/gi, '.');
}

function executerGit(racine, args) {
  const candidats = [
    process.env.GIT_EXE,
    'git',
    path.join(process.env.LOCALAPPDATA || '', 'GitHubDesktop', 'app-3.6.4', 'resources', 'app', 'git', 'cmd', 'git.exe')
  ].filter(Boolean);
  let dernier = null;
  for (const exe of candidats) {
    try {
      execFileSync(exe, ['-C', racine, ...args], { stdio: 'ignore' });
      return { ok: true };
    } catch (e) {
      dernier = e;
      if (e && e.status === 1) return { ok: false, code: 1 };
      if (e && e.code === 'ENOENT') continue;
      return { ok: false, code: e && e.status };
    }
  }
  return { ok: false, code: dernier && dernier.status, absent: true };
}

function cheminEstSuiviParGit(racine, relatifPosix) {
  const r = executerGit(racine, ['ls-files', '--error-unmatch', '--', relatifPosix]);
  if (r.ok) return true;
  if (r.code === 1) return false;
  return true;
}

function listerFichiersTexte(racine) {
  const sortie = [];
  if (!fs.existsSync(racine)) return sortie;
  (function descendre(dossier) {
    let entrees;
    try { entrees = fs.readdirSync(dossier, { withFileTypes: true }); }
    catch (e) { return; }
    for (const entree of entrees) {
      if (entree.name === '.git' || entree.name === 'node_modules' || entree.name === '.cursor' || entree.name === 'prototypes' || entree.name === 'canvases') continue;
      const complet = path.join(dossier, entree.name);
      if (entree.isDirectory()) descendre(complet);
      else if (entree.isFile() && EXTENSIONS_TEXTE.has(path.extname(entree.name).toLowerCase())) {
        sortie.push(complet);
      }
    }
  })(racine);
  return sortie;
}

function chargerJson(chemin) {
  try {
    return JSON.parse(fs.readFileSync(chemin, 'utf8'));
  } catch (e) {
    return { __erreur: e.message || String(e) };
  }
}

function parcourirChampsInterdits(valeur, aRetirer, id, fuites, fichier) {
  if (Array.isArray(valeur)) {
    valeur.forEach(v => parcourirChampsInterdits(v, aRetirer, id, fuites, fichier));
    return;
  }
  if (!valeur || typeof valeur !== 'object') return;
  const idCourant = valeur.id || id;
  for (const [cle, v] of Object.entries(valeur)) {
    if (aRetirer.has(cle)) {
      fuites.push({
        fichier, champ: cle, entree: idCourant || '(racine)',
        raison: 'champ exclu par la politique, présent dans la projection déployée'
      });
    }
    parcourirChampsInterdits(v, aRetirer, idCourant, fuites, fichier);
  }
}

function courrielsDansTexte(texte) {
  const brut = decoderTexte(texte);
  return new Set((brut.match(MOTIF_COURRIEL) || []).map(a => a.toLowerCase()));
}

function collecterCourrielsParChamp(donnees, champ) {
  const set = new Set();
  (function parcourir(valeur) {
    if (Array.isArray(valeur)) { valeur.forEach(parcourir); return; }
    if (!valeur || typeof valeur !== 'object') return;
    const brut = valeur[champ];
    if (typeof brut === 'string' && brut.includes('@')) {
      for (const morceau of brut.split(/[,;\s]+/)) {
        const a = morceau.trim().toLowerCase();
        if (a.includes('@')) set.add(a);
      }
    }
    Object.values(valeur).forEach(parcourir);
  })(donnees);
  return set;
}

function contexteAutoriseClinique(relatifFichier, adresse, courrielsCliniques) {
  if (!courrielsCliniques.has(adresse)) return false;
  return relatifFichier === 'data.json'
    || /(^|\/)cliniques\//.test(relatifFichier)
    || /(^|\/)rls\//.test(relatifFichier)
    || /(^|\/)recherche\//.test(relatifFichier);
}

function contexteAutoriseCentre(relatifFichier, adresse, courrielsCentreAutorises) {
  if (!courrielsCentreAutorises.has(adresse)) return false;
  return /(^|\/)monteregie-centre\//.test(relatifFichier)
    || /(^|\/)data-etablissements-centre\.json$/.test(relatifFichier);
}

function contexteAutorise(relatifFichier, adresse, courrielsCliniques, courrielsCentreAutorises) {
  return contexteAutoriseClinique(relatifFichier, adresse, courrielsCliniques)
    || contexteAutoriseCentre(relatifFichier, adresse, courrielsCentreAutorises);
}

function verifier(options = {}) {
  const sortie = path.resolve(options.sortie || RACINE_DEPOT);
  const priveEst = options.priveEst || '';
  const fuites = [];

  const fichiers = listerFichiersTexte(sortie);
  const scanDepotComplet = sortie === RACINE_DEPOT;
  for (const f of fichiers) {
    const rel = relatif(sortie, f);
    const sourceTravail = SOURCE_TRAVAIL_ETABLISSEMENTS.test(rel);
    const sourceEncoreSuivie = sourceTravail && (!scanDepotComplet || cheminEstSuiviParGit(RACINE_DEPOT, rel));
    if (NOMS_PRIVES.test(rel) || ARCHIVES_PRIVEES.test(rel) || sourceEncoreSuivie) {
      fuites.push({
        fichier: rel, champ: '(fichier)', entree: '(artefact)',
        raison: 'fichier de travail ou archive privée présent dans l\'artefact publié'
      });
    }
  }

  const cheminDonneesEst = path.join(sortie, 'data-etablissements.json');
  if (!fs.existsSync(cheminDonneesEst)) {
    fuites.push({
      fichier: 'data-etablissements.json', champ: '(fichier)', entree: '(racine)',
      raison: 'entrée requise absente : la projection publique Est doit être dans l\'artefact'
    });
  } else {
    const donnees = chargerJson(cheminDonneesEst);
    if (donnees.__erreur) {
      fuites.push({
        fichier: 'data-etablissements.json', champ: '(fichier)', entree: '(racine)',
        raison: 'entrée requise illisible ou JSON invalide'
      });
    } else {
      const aRetirer = champsARetirer(donnees);
      parcourirChampsInterdits(donnees, aRetirer, null, fuites, 'data-etablissements.json');
    }
  }

  const cheminDonneesCentre = path.join(sortie, 'data-etablissements-centre.json');
  const courrielsCentreAutorises = new Set();
  if (fs.existsSync(cheminDonneesCentre)) {
    const donneesC = chargerJson(cheminDonneesCentre);
    if (!donneesC.__erreur) {
      const polC = politiqueDe(donneesC);
      if (polC.afficherResponsableCourriel === true) {
        (function collecter(v) {
          if (Array.isArray(v)) { v.forEach(collecter); return; }
          if (!v || typeof v !== 'object') return;
          if (typeof v.responsableCourriel === 'string' && v.responsableCourriel.trim()) {
            courrielsCentreAutorises.add(v.responsableCourriel.trim().toLowerCase());
          }
          if (v.recrutement && typeof v.recrutement.responsableCourriel === 'string') {
            courrielsCentreAutorises.add(v.recrutement.responsableCourriel.trim().toLowerCase());
          }
          Object.values(v).forEach(collecter);
        })(donneesC);
      }
    }
  }

  let empreintesEst = [];
  const cheminEmp = options.empreintes
    ? path.resolve(options.empreintes)
    : path.join(RACINE_DEPOT, 'scripts', 'empreintes-courriels-interdits.json');
  if (fs.existsSync(cheminEmp)) {
    try {
      const reg = JSON.parse(fs.readFileSync(cheminEmp, 'utf8'));
      empreintesEst = Array.isArray(reg.empreintes) ? reg.empreintes : [];
    } catch (e) {
      fuites.push({
        fichier: 'scripts/empreintes-courriels-interdits.json', champ: '(fichier)',
        entree: '(registre)', raison: 'registre d\'empreintes illisible'
      });
    }
  }

  const cheminCliniques = path.join(sortie, 'data.json');
  let courrielsCliniques = new Set();
  if (fs.existsSync(cheminCliniques)) {
    const donneesClin = chargerJson(cheminCliniques);
    if (!donneesClin.__erreur) {
      courrielsCliniques = collecterCourrielsParChamp(donneesClin, 'personneRessource');
    }
  } else {
    const fallback = path.join(RACINE_DEPOT, 'data.json');
    if (fs.existsSync(fallback)) {
      const donneesClin = chargerJson(fallback);
      if (!donneesClin.__erreur) {
        courrielsCliniques = collecterCourrielsParChamp(donneesClin, 'personneRessource');
      }
    }
  }

  const fichiersAScruter = fichiers.filter(f => {
    const rel = relatif(sortie, f);
    if (rel.startsWith('scripts/test-')) return false;
    if (rel === 'scripts/empreintes-courriels-interdits.json') return false;
    if (rel === 'scripts/projeter-etablissements.js') return false;
    if (rel === 'scripts/verifier-fuites-etablissements.js') return false;
    if (scanDepotComplet && SOURCE_TRAVAIL_ETABLISSEMENTS.test(rel)
      && !cheminEstSuiviParGit(RACINE_DEPOT, rel)) return false;
    return true;
  });

  for (const f of fichiersAScruter) {
    const rel = relatif(sortie, f);
    let texte;
    try { texte = fs.readFileSync(f, 'utf8'); }
    catch (e) { continue; }
    const trouvees = courrielsDansTexte(texte);
    for (const adresse of trouvees) {
      if (ADRESSES_PUBLIQUES_SITE.has(adresse)) continue;
      if (contexteAutorise(rel, adresse, courrielsCliniques, courrielsCentreAutorises)) continue;
      if (empreintesEst.includes(empreinteCourriel(adresse))) {
        fuites.push({
          fichier: rel, champ: 'responsableCourriel',
          entree: '(adresse interdite pour l\'Est, retrouvée hors contexte autorisé)',
          raison: 'empreinte d\'un courriel Est interdit présente dans l\'artefact'
        });
      }
    }
  }

  if (priveEst && fs.existsSync(priveEst)) {
    const source = chargerJson(priveEst);
    if (!source.__erreur) {
      const { valeursInterdites } = require('./projeter-etablissements.js');
      const interdites = valeursInterdites(source);
      for (const f of fichiersAScruter) {
        const rel = relatif(sortie, f);
        const texte = decoderTexte(fs.readFileSync(f, 'utf8'));
        for (const [valeur, meta] of interdites) {
          if (meta.champ === 'responsableCourriel'
            && contexteAutorise(rel, valeur.toLowerCase(), courrielsCliniques, courrielsCentreAutorises)) {
            continue;
          }
          if (texte.includes(valeur)) {
            fuites.push({
              fichier: rel, champ: meta.champ, entree: meta.id || '(inconnue)',
              raison: 'valeur retirée par la projection, retrouvée dans une sortie déployée'
            });
          }
        }
      }
    }
  }

  const uniques = [];
  const vus = new Set();
  for (const f of fuites) {
    const cle = `${f.fichier}|${f.champ}|${f.entree}|${f.raison}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    uniques.push(f);
  }

  if (uniques.length) {
    console.error('\nFUITE DE DONNÉES D\'ÉTABLISSEMENT. Publication annulée.\n');
    for (const f of uniques) {
      console.error(`  ${f.fichier}  ·  champ ${f.champ}  ·  entrée ${f.entree}`);
      console.error(`      ${f.raison}`);
    }
    console.error(`\n${uniques.length} anomalie(s). Les valeurs ne sont pas recopiées dans ce journal.`);
    return { ok: false, fuites: uniques };
  }

  console.log('Aucune fuite de données d\'établissement détectée.');
  return { ok: true, fuites: [] };
}

if (require.main === module) {
  const opts = argsNommes(process.argv.slice(2));
  const r = verifier(opts);
  process.exit(r.ok ? 0 : 1);
}

module.exports = { verifier, decoderTexte, argsNommes };
