#!/usr/bin/env node
/**
 * Extrait les lignes bleues (ne pas afficher) et rouges (corrections) du répertoire Word,
 * puis compare aux cliniques Montérégie-Est dans data.json.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const DOCX = 'C:/Users/olapl/Desktop/Répertoire - Montérégie Est.docx';
const DATA = path.join(__dirname, '..', 'data.json');

const BLUE = new Set(['0070C0']);
const RED = new Set(['FF0000', 'C00000']);

function runColor(val) {
  if (!val) return null;
  const u = val.toUpperCase();
  if (BLUE.has(u)) return 'blue';
  if (RED.has(u)) return 'red';
  return null;
}

function norm(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractDocx() {
  const tmp = path.join(os.tmpdir(), 'rep-docx-' + Date.now());
  const zip = path.join(os.tmpdir(), 'rep-docx.zip');
  fs.copyFileSync(DOCX, zip);
  fs.mkdirSync(tmp, { recursive: true });
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zip}' -DestinationPath '${tmp}' -Force"`,
    { stdio: 'pipe' }
  );
  const xml = fs.readFileSync(path.join(tmp, 'word/document.xml'), 'utf8');
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.unlinkSync(zip);
  } catch {}

  const paras = xml.split(/<w:p[ >]/).slice(1);
  const blue = [];
  const red = [];
  const entries = [];

  for (const p of paras) {
    const runs = [...p.matchAll(/<w:r[\s>][\s\S]*?<\/w:r>/g)];
    let text = '';
    let colors = new Set();
    for (const r of runs) {
      const t = [...r[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map((m) => m[1])
        .join('');
      if (!t) continue;
      const col = (r[0].match(/w:color w:val="([^"]+)"/) || [])[1];
      text += t;
      const c = runColor(col);
      if (c) colors.add(c);
    }
    text = text.trim();
    if (!text || text.length < 3) continue;

    const hasBlue = colors.has('blue');
    const hasRed = colors.has('red');
    if (hasBlue) blue.push(text);
    else if (hasRed) red.push(text);

    if (
      hasBlue ||
      hasRed ||
      /^(GMF|CLSC|Bureau|Clinique|Centre|Cabinet|Le CLSC|CMI|Santé|Maison|Dre |Dr )/i.test(text)
    ) {
      entries.push({ text, mark: hasBlue ? 'bleu' : hasRed ? 'rouge' : 'noir' });
    }
  }

  return { blue, red, entries };
}

function loadEstCliniques() {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  return data.cliniques.filter((c) => c.region === 'Est');
}

function matchName(docName, cliniques) {
  const dn = norm(docName);
  if (!dn || dn.length < 4) return null;
  let best = null;
  let bestScore = 0;
  for (const c of cliniques) {
    const cn = norm(c.nom || '');
    if (!cn) continue;
    if (cn.includes(dn) || dn.includes(cn)) {
      const score = Math.min(cn.length, dn.length);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
  }
  return best;
}

function main() {
  const { blue, red } = extractDocx();
  const cliniques = loadEstCliniques();
  const onCarte = cliniques.filter((c) => c.visible !== false);
  const recrute = onCarte.filter((c) => c.recrutementActif !== false);

  console.log('=== RÉPERTOIRE WORD (Montérégie-Est) ===\n');
  console.log('BLEU — ne pas afficher (' + blue.length + ' lignes brutes)');
  const blueNames = blue.filter(
    (t) =>
      t.length > 8 &&
      !/^(Clinique médicale|CLSC|RLS|Richelieu|Pierre|Total|Répertoire|Bureau$)/i.test(t) &&
      !/^\d/.test(t)
  );
  blueNames.forEach((n) => console.log('  [bleu]', n));

  console.log('\nROUGE — corrections (' + red.length + ' lignes brutes)');
  const redNames = red.filter(
    (t) =>
      t.length > 4 &&
      !/^(établissement|Secteur|Clinique en recrutement|NE RECRUTE|Pierre-Boucher|Pierre-De Saurel|CLSC$)/i.test(
        t
      ) &&
      !/^\d/.test(t)
  );
  redNames.forEach((n) => console.log('  [rouge]', n));

  console.log('\n=== COMPARAISON data.json (region Est) ===');
  console.log('Publiées (visible):', onCarte.length);
  console.log('Recrutement actif:', recrute.length);

  console.log('\n--- Bleu sur carte (à retirer si présent) ---');
  for (const name of blueNames) {
    const c = matchName(name, onCarte);
    if (c) {
      const actif = c.recrutementActif !== false ? 'actif' : 'inactif';
      console.log(`  TROUVÉ [${actif}] id=${c.id} — doc: "${name}" ↔ site: "${c.nom}"`);
    }
  }

  console.log('\n--- Rouge — écarts nommage / statut ---');
  const redChecks = [
    'GMF Fusion',
    'GMF 3090',
    'GMF St-Mathieu',
    'GMF Richelieu',
    'Marguerite',
    'Autre Maison',
    'Patriotes',
    'Sorel-Tracy',
    'Maison Victor',
    'Josée Mercier',
    'Paul Sader',
    'Varennes',
  ];
  for (const key of redChecks) {
    const hits = onCarte.filter((c) => norm(c.nom).includes(norm(key)));
    for (const c of hits) {
      const actif = c.recrutementActif !== false ? 'actif' : 'inactif';
      console.log(`  id=${c.id} [${actif}] "${c.nom}"`);
    }
  }

  console.log('\n--- Sur carte mais pas « sur la carte » dans le doc (recrutementActif=false) ---');
  const docSurCarteHints = [
    "marguerite",
    "autre maison",
    "patriotes pure",
    "fusion",
    "3090",
    "st-mathieu",
    "richelieu",
  ];
  for (const c of onCarte) {
    const n = norm(c.nom);
    const inDoc = docSurCarteHints.some((h) => n.includes(h));
    if (inDoc && c.recrutementActif === false) {
      console.log(`  id=${c.id} recrutementActif=false — "${c.nom}"`);
    }
  }
}

main();
