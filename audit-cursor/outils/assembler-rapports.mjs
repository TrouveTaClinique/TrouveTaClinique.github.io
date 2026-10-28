#!/usr/bin/env node
/* Audit Cursor : assemble les rapports en un seul fichier à transmettre,
   audit-cursor/rapports/AUDIT-COMPLET.md (bilan des constats par gravité, puis chaque rapport).
   Avant d'assembler, cherche les données qui ne doivent pas figurer dans un rapport (courriels,
   numéros de téléphone, clés) et les signale par fichier et ligne, sans les recopier.
   Usage, depuis la racine du dépôt : node audit-cursor/outils/assembler-rapports.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAPPORTS = path.join(RACINE, 'audit-cursor', 'rapports');
const SORTIE = 'AUDIT-COMPLET.md';
const GRAVITES = ['Critique', 'Élevée', 'Moyenne', 'Faible', 'Info'];
const sansAccents = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* Données interdites dans un rapport (voir audit-cursor/REGLES.md, section 2). */
const COURRIELS_PERMIS = new Set(['contact@trouvetaclinique.ca', 'exemple.fictif@exemple.org']);
const MOTIFS = [
  ['courriel', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, v => !COURRIELS_PERMIS.has(v.toLowerCase())],
  ['numéro de téléphone', /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, () => true],
  ['clé ou jeton', /sk-ant-[\w-]{6,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY/g, () => true]
];

if (!fs.existsSync(RAPPORTS)) {
  console.error('Aucun dossier audit-cursor/rapports : lance d’abord les missions.');
  process.exit(1);
}
const fichiers = fs.readdirSync(RAPPORTS).filter(f => /^\d{2}-.+\.md$/.test(f)).sort();
if (!fichiers.length) {
  console.error('Aucun rapport (fichiers NN-nom.md) dans audit-cursor/rapports.');
  process.exit(1);
}

const alertes = [];
const bilan = fichiers.map(fichier => {
  const texte = fs.readFileSync(path.join(RAPPORTS, fichier), 'utf8');
  const comptes = Object.fromEntries(GRAVITES.map(g => [g, 0]));
  texte.split(/\r?\n/).forEach((ligne, i) => {
    const cellules = ligne.split('|').map(c => c.trim());
    const gravite = cellules.length > 3 && GRAVITES.find(g => sansAccents(g) === sansAccents(cellules[2] || ''));
    if (gravite && /^\d{2}-\d+/.test(cellules[1])) comptes[gravite]++;
    for (const [type, motif, interdit] of MOTIFS) {
      for (const m of ligne.matchAll(motif)) if (interdit(m[0])) alertes.push(`${fichier}, ligne ${i + 1} : ${type}`);
    }
  });
  const titre = (texte.match(/^# (.+)$/m) || [, fichier])[1];
  return { fichier, titre, texte, comptes };
});

const git = (...args) => (spawnSync('git', args, { cwd: RACINE, encoding: 'utf8' }).stdout || '').trim();
const date = new Date().toLocaleString('sv-SE', { timeZone: 'America/Toronto' }).slice(0, 16);
const total = Object.fromEntries(GRAVITES.map(g => [g, bilan.reduce((s, b) => s + b.comptes[g], 0)]));
const lignes = [
  '# Audit complet de Trouve ta clinique', '',
  `- Assemblé le ${date} (heure du Québec), commit ${git('rev-parse', '--short', 'HEAD')}`,
  `- ${fichiers.length} rapports`, '',
  '## Bilan des constats', '',
  `| Rapport | ${GRAVITES.join(' | ')} |`, `|---|${GRAVITES.map(() => '---').join('|')}|`,
  ...bilan.map(b => `| ${b.titre} | ${GRAVITES.map(g => b.comptes[g] || '').join(' | ')} |`),
  `| **Total** | ${GRAVITES.map(g => `**${total[g]}**`).join(' | ')} |`, ''
];
if (alertes.length) {
  lignes.push('## À corriger avant d’envoyer', '', 'Données qui ne devraient pas figurer dans un rapport :', '', ...alertes.map(a => `- ${a}`), '');
}
for (const b of bilan) lignes.push('---', '', b.texte.trim(), '');

fs.writeFileSync(path.join(RAPPORTS, SORTIE), lignes.join('\n'));
console.log(`${SORTIE} écrit : ${fichiers.length} rapports, ${GRAVITES.map(g => `${total[g]} ${g.toLowerCase()}`).join(', ')}.`);
const modifies = git('status', '--porcelain', '--untracked-files=no');
if (modifies) console.log(`ATTENTION : des fichiers suivis par git ont été modifiés :\n${modifies}`);
if (alertes.length) {
  console.log(`ATTENTION : ${alertes.length} donnée(s) à retirer des rapports avant l’envoi :\n${alertes.map(a => `  ${a}`).join('\n')}`);
  process.exitCode = 1;
}
