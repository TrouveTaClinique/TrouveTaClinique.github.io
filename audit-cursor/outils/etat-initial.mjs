#!/usr/bin/env node
/* Audit Cursor : état initial du dépôt, en lecture seule.
   Note la branche, le commit, l'état git et les versions, compte les données, lance les tests
   et les vérifications du projet, puis écrit audit-cursor/rapports/00-etat-initial.md.
   Ne modifie aucun fichier suivi par git (le dossier rapports/ est ignoré).
   Usage, depuis la racine du dépôt : node audit-cursor/outils/etat-initial.mjs */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAPPORTS = path.join(RACINE, 'audit-cursor', 'rapports');
fs.mkdirSync(RAPPORTS, { recursive: true });

function lancer(commande, args) {
  const debut = Date.now();
  const r = spawnSync(commande, args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, sortie: `${r.stdout || ''}${r.stderr || ''}`, duree: Date.now() - debut, erreur: r.error ? r.error.message : '' };
}
const git = (...args) => lancer('git', args).sortie.trim();
const lireJson = fichier => JSON.parse(fs.readFileSync(path.join(RACINE, fichier), 'utf8'));
const dernieres = (texte, n) => texte.trim().split(/\r?\n/).slice(-n).join('\n');
const bloc = texte => '```text\n' + texte.replace(/```/g, "'''") + '\n```';

const etatAvant = git('status', '--porcelain', '--untracked-files=no');

/* Inventaire. */
const donnees = lireJson('data.json');
const cliniques = donnees.cliniques || [];
const catalogue = lireJson('guides/donnees.json');
const plan = fs.readFileSync(path.join(RACINE, 'sitemap.xml'), 'utf8');
function compterPages(dossier) {
  let n = 0;
  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    if (entree.name.startsWith('.') || ['node_modules', 'audit-cursor', 'scripts', 'workers', 'docs'].includes(entree.name)) continue;
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) n += compterPages(chemin);
    else if (entree.name === 'index.html') n++;
  }
  return n;
}

/* Tests et vérifications du projet (mêmes commandes que dans CLAUDE.md). */
const tests = fs.readdirSync(path.join(RACINE, 'scripts')).filter(f => /^test-.*\.cjs$/.test(f)).sort().map(f => path.join('scripts', f));
const etapes = [
  ['Tests du site et du service d’IA', process.execPath, ['--test', '--test-reporter=tap', ...tests, path.join('workers', 'aiguillage', 'test', 'logique.test.js')]],
  ['Navigation de la carte de l’Est', process.execPath, [path.join('scripts', 'verifier-navigation-est.js')]],
  ['Fuites de données d’établissements', process.execPath, [path.join('scripts', 'verifier-fuites-etablissements.js')]]
];
const resultats = etapes.map(([nom, commande, args]) => {
  process.stdout.write(`${nom}… `);
  const r = lancer(commande, args);
  const bilan = ['tests', 'pass', 'fail'].map(m => (r.sortie.match(new RegExp(`^# ${m} (\\d+)`, 'm')) || [])[1]).filter(Boolean);
  console.log(r.code === 0 ? 'réussi' : `ÉCHEC (code ${r.code})`);
  return { nom, ...r, bilan };
});

const etatApres = git('status', '--porcelain', '--untracked-files=no');
const date = new Date().toLocaleString('sv-SE', { timeZone: 'America/Toronto' }).slice(0, 16);
const lignes = [
  '# Mission 00 : état initial du dépôt', '',
  `- Date : ${date} (heure du Québec)`,
  `- Branche : ${git('rev-parse', '--abbrev-ref', 'HEAD')}`,
  `- Commit audité : ${git('rev-parse', '--short', 'HEAD')} (${git('log', '-1', '--format=%cd · %s', '--date=short')})`,
  `- Node : ${process.version} · Système : ${os.type()} ${os.release()}`,
  `- Fichiers suivis modifiés avant l'audit : ${etatAvant ? 'OUI, voir plus bas' : 'aucun'}`, '',
  '## Inventaire', '',
  '| Élément | Nombre |', '|---|---|',
  `| Cliniques dans \`data.json\` (visibles) | ${cliniques.length} (${cliniques.filter(c => c.visible !== false).length}) |`,
  `| Hôpitaux dans \`data.json\` | ${(donnees.hopitaux || []).length} |`,
  `| Guides du catalogue | ${catalogue.filter(r => r.type !== 'communautaire').length} |`,
  `| Organismes communautaires | ${catalogue.filter(r => r.type === 'communautaire').length} |`,
  `| Adresses du plan du site (\`sitemap.xml\`) | ${(plan.match(/<loc>/g) || []).length} |`,
  `| Pages \`index.html\` générées ou publiées | ${compterPages(RACINE)} |`,
  `| Fichiers de test (\`scripts/test-*.cjs\`) | ${tests.length} |`, '',
  '## Tests et vérifications', '',
  '| Étape | Résultat | Durée | Bilan |', '|---|---|---|---|',
  ...resultats.map(r => `| ${r.nom} | ${r.code === 0 ? 'réussi' : `ÉCHEC (code ${r.code})`} | ${Math.round(r.duree / 1000)} s | ${r.bilan.length ? `tests ${r.bilan[0]}, réussis ${r.bilan[1]}, échecs ${r.bilan[2]}` : '-'} |`), ''
];
for (const r of resultats) {
  lignes.push(`### ${r.nom}`, '', r.erreur ? `Erreur au lancement : ${r.erreur}` : bloc(dernieres(r.sortie, r.code === 0 ? 6 : 40)), '');
}
if (etatAvant) lignes.push('## Fichiers suivis déjà modifiés avant l’audit', '', bloc(etatAvant), '');
if (etatApres !== etatAvant) lignes.push('## ATTENTION : les tests ont modifié des fichiers suivis', '', bloc(etatApres), '');

const sortie = path.join(RAPPORTS, '00-etat-initial.md');
fs.writeFileSync(sortie, lignes.join('\n'));
console.log(`\nÉtat initial écrit dans ${path.relative(RACINE, sortie)}`);
if (etatApres !== etatAvant) console.log('ATTENTION : des fichiers suivis ont changé pendant les tests (voir le rapport).');
process.exitCode = resultats.every(r => r.code === 0) ? 0 : 1;
