'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const { projeter, registreEmpreintes, empreinteCourriel } = require('./projeter-etablissements.js');
const { verifier } = require('./verifier-fuites-etablissements.js');

const SYNTH_EST = 'fuite.synthetique.est@example.test';
const SYNTH_CENTRE = 'contact.autorise.centre@example.test';

function politiqueEst() {
  return {
    afficherETC: false,
    afficherResponsableNom: true,
    afficherResponsableCourriel: false,
    contactAffiche: 'À venir',
    champsInternes: ['etc', 'responsableNom', 'responsableCourriel', 'notesInternes', 'valeursSource', 'decision']
  };
}

function sourceEst() {
  return {
    meta: { politiqueAffichage: politiqueEst() },
    installations: [{ id: 'INS-S-001', nom: 'Hôpital synthétique', responsableCourriel: SYNTH_EST }],
    secteurs: [{
      id: 'SEC-S-001',
      installationId: 'INS-S-001',
      responsableNom: 'Dre Synthèse',
      responsableCourriel: SYNTH_EST,
      extra: { notesInternes: '' }
    }]
  };
}

function ecrireJson(dir, nom, obj) {
  fs.writeFileSync(path.join(dir, nom), JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function artefactSain(dir) {
  const prive = sourceEst();
  const pub = projeter(prive);
  ecrireJson(dir, 'data-etablissements.json', pub);
  fs.mkdirSync(path.join(dir, 'monteregie-est', 'etablissements', 'hopital-synthetique'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'monteregie-est', 'etablissements', 'hopital-synthetique', 'index.html'),
    '<!doctype html><p>Contact : Dre Synthèse. À venir.</p>\n',
    'utf8'
  );
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><p>Accueil</p>\n', 'utf8');
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets', 'ok.js'), 'console.log("ok");\n', 'utf8');
  const centre = {
    meta: { politiqueAffichage: { afficherResponsableCourriel: true, afficherResponsableNom: true, champsInternes: [] } },
    installations: [],
    secteurs: [{ id: 'SEC-C-S', recrutement: { responsableNom: 'Dr Centre', responsableCourriel: SYNTH_CENTRE } }]
  };
  ecrireJson(dir, 'data-etablissements-centre.json', centre);
  fs.mkdirSync(path.join(dir, 'monteregie-centre', 'etablissements', 'demo'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'monteregie-centre', 'etablissements', 'demo', 'index.html'),
    `<p>Contact : <a href="mailto:${SYNTH_CENTRE}">${SYNTH_CENTRE}</a></p>\n`,
    'utf8'
  );
  const emp = path.join(dir, 'empreintes-test.json');
  fs.writeFileSync(emp, JSON.stringify(registreEmpreintes(prive, 'Est'), null, 2) + '\n', 'utf8');
  return emp;
}

function controler(dir, emp, extra = {}) {
  return verifier({ sortie: dir, empreintes: emp, ...extra });
}

test('cas sain : projection sans champ interne, contacts Centre conservés', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-fuite-ok-'));
  try {
    const emp = artefactSain(dir);
    const r = controler(dir, emp);
    assert.equal(r.ok, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('courriel dans une fiche d\'établissement surveillée', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-fuite-fiche-'));
  try {
    const emp = artefactSain(dir);
    fs.writeFileSync(
      path.join(dir, 'monteregie-est', 'etablissements', 'hopital-synthetique', 'index.html'),
      `<p><a href="mailto:${SYNTH_EST}">x</a></p>\n`,
      'utf8'
    );
    const r = controler(dir, emp);
    assert.equal(r.ok, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('même courriel dans index.html', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-fuite-index-'));
  try {
    const emp = artefactSain(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), `<p>${SYNTH_EST}</p>\n`, 'utf8');
    const r = controler(dir, emp);
    assert.equal(r.ok, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('même courriel dans un JavaScript sous assets/', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-fuite-assets-'));
  try {
    const emp = artefactSain(dir);
    fs.writeFileSync(path.join(dir, 'assets', 'ok.js'), `var x="${SYNTH_EST}";\n`, 'utf8');
    const r = controler(dir, emp);
    assert.equal(r.ok, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('copie du JSON brut dans un autre JSON à la racine', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-fuite-json-'));
  try {
    const emp = artefactSain(dir);
    ecrireJson(dir, 'copie-brute.json', sourceEst());
    const r = controler(dir, emp);
    assert.equal(r.ok, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('courriel JavaScript avec @ encodé en \\u0040', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-fuite-u40-'));
  try {
    const emp = artefactSain(dir);
    const local = SYNTH_EST.replace('@', '\\u0040');
    fs.writeFileSync(path.join(dir, 'assets', 'ok.js'), `var x="${local}";\n`, 'utf8');
    const r = controler(dir, emp);
    assert.equal(r.ok, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('notesInternes imbriqué dans un secteur', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-fuite-notes-'));
  try {
    const emp = artefactSain(dir);
    const pub = JSON.parse(fs.readFileSync(path.join(dir, 'data-etablissements.json'), 'utf8'));
    pub.secteurs[0].enveloppe = { notesInternes: '' };
    ecrireJson(dir, 'data-etablissements.json', pub);
    const r = controler(dir, emp);
    assert.equal(r.ok, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('entrée requise absente : échec, pas un succès silencieux', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-fuite-absent-'));
  try {
    fs.writeFileSync(path.join(dir, 'index.html'), '<p>ok</p>\n', 'utf8');
    const r = verifier({ sortie: dir, empreintes: path.join(dir, 'absent.json') });
    assert.equal(r.ok, false);
    assert.ok(r.fuites.some(f => /absente/.test(f.raison)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('mode CI sans fichier privé : empreintes toujours détectées', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-fuite-ci-'));
  try {
    const emp = artefactSain(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), `<p>${SYNTH_EST}</p>\n`, 'utf8');
    const r = controler(dir, emp, { priveEst: '' });
    assert.equal(r.ok, false);
    assert.equal(empreinteCourriel(SYNTH_EST).length, 64);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('fichier privé dans l\'artefact : échec', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-fuite-prive-'));
  try {
    const emp = artefactSain(dir);
    fs.writeFileSync(path.join(dir, 'data-etablissements.prive.json'), '{}\n', 'utf8');
    const r = controler(dir, emp);
    assert.equal(r.ok, false);
    assert.ok(r.fuites.some(f => /fichier de travail/.test(f.raison)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('source de travail scripts/donnees-etablissements-source.json dans l\'artefact : échec', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-fuite-source-'));
  try {
    const emp = artefactSain(dir);
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    ecrireJson(path.join(dir, 'scripts'), 'donnees-etablissements-source.json', {
      meta: { politiqueAffichage: politiqueEst() },
      etablissements: [{
        id: 'INS-S-001',
        responsableCourriel: SYNTH_EST,
        extra: { notesInternes: 'note interne synthétique' }
      }]
    });
    const r = controler(dir, emp);
    assert.equal(r.ok, false);
    assert.ok(r.fuites.some(f =>
      f.fichier.replace(/\\/g, '/') === 'scripts/donnees-etablissements-source.json'
      && /fichier de travail/.test(f.raison)
    ));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
