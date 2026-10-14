'use strict';
/* Courriels retirés du site le 8 oct. 2026, « jusqu'à nouvel ordre » (scripts/masquer-courriels.js).
   Le test lit les fichiers tels qu'ils sont publiés (liste blanche de preparer-apercu.js, JSON de
   données filtrés par donneesPubliques) : un export du classeur qui remettrait des courriels dans
   data.json ne bloque donc pas le robot, mais une page ou un fichier publié qui en afficherait un,
   oui. Adresses permises : celle du site et les deux adresses génériques de recrutement des CISSS
   (Est : fiches de l'Est et page PTEM ; Ouest : page PTEM), décision du 10 oct. 2026.
   Les tests suivent les interrupteurs PUBLIER_COURRIELS_SITE et PUBLIER_COURRIELS_CARTE : le jour où
   le propriétaire donne son accord pour réafficher les courriels sur la carte, mettre
   PUBLIER_COURRIELS_CARTE à true suffit, aucun test ne bloque (voir CLAUDE.md).
   13 oct. 2026 (accord du propriétaire) : les cliniques des régions de REGIONS_COURRIELS_CARTE (l'Est)
   gardent leurs courriels dans les JSON publiés ; tout le reste des données et toutes les pages du
   site restent vérifiés comme avant. 14 oct. 2026 : seule la carte de l'Est les affiche. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  PUBLIER_COURRIELS_SITE, PUBLIER_COURRIELS_CARTE, REGIONS_COURRIELS_CARTE, REGIONS_COURRIELS_SECTEURS_CARTE, A_VENIR, masquer, masquerCourriels, masquerTexte,
  contientCourriel
} = require('./masquer-courriels.js');
const { lister, donneesPubliques, FICHIERS_DONNEES, RACINE } = require('./preparer-apercu.js');

const COURRIEL_CISSS_EST = 'recrutement.md.cisssme16@ssss.gouv.qc.ca';
const COURRIEL_CISSS_OUEST = 'recrutement_omnis.cisssmo16@ssss.gouv.qc.ca';
const PERMISES = new Set(['contact@trouvetaclinique.ca', COURRIEL_CISSS_EST, COURRIEL_CISSS_OUEST]);
const PAGES_CARTES = new Set(['monteregie-est/index.html', 'monteregie/index.html']);
const RE_COURRIEL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const TEXTE = /\.(html|json|js|xml|txt|webmanifest|css|csv|md)$/i;
const regionPubliee = c => REGIONS_COURRIELS_CARTE.includes(c && c.region);
const secteursPublies = d => REGIONS_COURRIELS_SECTEURS_CARTE.includes(d && d.regionApplication);
/* JSON publié sans les cliniques ni les secteurs dont les courriels sont permis sur les cartes. */
function publieHorsExceptions(texte) {
  const json = JSON.parse(donneesPubliques(texte));
  if (Array.isArray(json.cliniques)) json.cliniques = json.cliniques.filter(c => !regionPubliee(c));
  if (Array.isArray(json.secteurs) && secteursPublies(json)) json.secteurs = [];
  return JSON.stringify(json, null, 2);
}

test('interrupteurs des courriels : site et carte réglés séparément', () => {
  assert.equal(typeof PUBLIER_COURRIELS_SITE, 'boolean');
  assert.equal(typeof PUBLIER_COURRIELS_CARTE, 'boolean');
  assert.ok(Array.isArray(REGIONS_COURRIELS_CARTE) && REGIONS_COURRIELS_CARTE.every(r => typeof r === 'string'));
});

test('masquerCourriels : chaque champ reçoit la bonne valeur', () => {
  const avant = {
    cliniques: [{
      nom: 'Clinique test',
      personneRessource: 'prenom.nom@gmail.com',
      infos: 'Écrire à recrutement@exemple.qc.ca ou à contact@trouvetaclinique.ca.',
      evenement: { titre: 'Portes ouvertes', courriel: 'rsvp@exemple.ca' },
      annonce: { texte: 'Inscription', lien: 'mailto:inscription@exemple.ca' }
    }, {
      nom: 'Sans courriel',
      personneRessource: 'Dre Une Telle',
      site: 'https://exemple.ca/'
    }],
    etablissements: [{ responsable: 'Dr Untel', responsableCourriel: 'untel@gmail.com' }]
  };
  const apres = masquer(avant, '', false);
  const [c1, c2] = apres.cliniques;
  assert.equal(c1.personneRessource, A_VENIR);
  assert.equal(c1.infos, `Écrire à ${A_VENIR} ou à contact@trouvetaclinique.ca.`);
  assert.equal(c1.evenement.courriel, '');
  assert.equal(c1.evenement.titre, 'Portes ouvertes');
  assert.equal(c1.annonce.lien, '');
  assert.equal(c2.personneRessource, 'Dre Une Telle');
  assert.equal(c2.site, 'https://exemple.ca/');
  assert.equal(apres.etablissements[0].responsableCourriel, '');
  assert.equal(apres.etablissements[0].responsable, 'Dr Untel');
  assert.equal(avant.cliniques[0].personneRessource, 'prenom.nom@gmail.com', 'l’original n’est pas modifié');
  assert.equal(masquerTexte('mailto:a.b@c.ca'), A_VENIR);
  assert.equal(contientCourriel('contact@trouvetaclinique.ca'), false);
  assert.equal(masquer(avant, '', true).cliniques[0].personneRessource, 'prenom.nom@gmail.com', 'interrupteur ouvert : courriel gardé');
});

test('aucun fichier publié ne contient d’autre courriel que ceux permis (selon les interrupteurs)', () => {
  const trouves = [];
  for (const fichier of lister(RACINE)) {
    if (!TEXTE.test(fichier)) continue;
    const cote = FICHIERS_DONNEES.has(fichier) || PAGES_CARTES.has(fichier) ? PUBLIER_COURRIELS_CARTE : PUBLIER_COURRIELS_SITE;
    if (cote) continue;
    let texte = fs.readFileSync(path.join(RACINE, fichier), 'utf8');
    if (FICHIERS_DONNEES.has(fichier)) texte = publieHorsExceptions(texte);
    for (const m of texte.match(RE_COURRIEL) || []) {
      const adresse = m.toLowerCase();
      if (PERMISES.has(adresse) || /\.(png|jpe?g|webp|svg|gif|js|css)$/.test(adresse)) continue;
      trouves.push(`${fichier} : ${m}`);
    }
  }
  assert.deepEqual(trouves, []);
});

test('les JSON publiés ne gardent aucun courriel, même si data.json en recevait', { skip: PUBLIER_COURRIELS_CARTE && 'courriels réaffichés sur la carte' }, () => {
  for (const fichier of FICHIERS_DONNEES) {
    const brut = JSON.parse(fs.readFileSync(path.join(RACINE, fichier), 'utf8'));
    if (brut.cliniques) brut.cliniques.find(c => !regionPubliee(c)).personneRessource = 'quelquun@gmail.com';
    if (brut.secteurs && !secteursPublies(brut)) brut.secteurs[0].recrutement = { responsableCourriel: 'quelquun@gmail.com' };
    brut.meta = { ...(brut.meta || {}), note: 'Écrire à quelquun@gmail.com' };
    const publie = donneesPubliques(JSON.stringify(brut));
    assert.doesNotMatch(publie, /quelquun@gmail\.com/, fichier);
  }
});

/* Contacts retirés à la demande de la personne (9 oct. 2026) : « contactMasque: true ». Le test
   nomme le secteur par son identifiant seulement ; ne jamais écrire le nom retiré dans le dépôt. */
test('contactMasque : nom, courriel et téléphone retirés de tout ce qui est publié', () => {
  const apres = masquer({ secteurs: [
    { id: 'X', recrutement: { responsableNom: 'Dre Une Telle', responsableCourriel: 'une.telle@exemple.ca',
      telephone: '450 555-0000', besoinDeclare: '1 poste', contactMasque: true } },
    { id: 'Y', recrutement: { responsableNom: 'Dr Autre', contactMasque: false } }
  ] }, '', true);
  const [x, y] = apres.secteurs;
  assert.equal(x.recrutement.responsableNom, '');
  assert.equal(x.recrutement.responsableCourriel, '');
  assert.equal(x.recrutement.telephone, '');
  assert.equal(x.recrutement.besoinDeclare, '1 poste');
  assert.equal(y.recrutement.responsableNom, 'Dr Autre');
});

test('secteur SEC-C-010 : contact retiré dans les données, sur la fiche et sur les cartes', () => {
  const centre = JSON.parse(fs.readFileSync(path.join(RACINE, 'data-etablissements-centre.json'), 'utf8'));
  const sec = centre.secteurs.find(s => s.id === 'SEC-C-010');
  assert.equal(sec.recrutement.contactMasque, true);
  assert.equal(sec.recrutement.responsableNom, '');
  const inst = centre.installations.find(i => i.id === sec.installationId);
  assert.ok(inst, 'installation du secteur');
  const fiche = fs.readFileSync(path.join(RACINE, 'monteregie-centre/etablissements/clinique-jeunesse-de-saint-jean-sur-richelieu/index.html'), 'utf8');
  assert.doesNotMatch(fiche, /<p>Contact :/);
  for (const carte of ['monteregie/index.html', 'monteregie-est/index.html']) {
    const html = fs.readFileSync(path.join(RACINE, carte), 'utf8');
    assert.match(html, /contactMasque: !!\(sec\.contactMasque \|\| \(sec\.recrutement \|\| \{\}\)\.contactMasque\)/, carte);
    assert.match(html, /\$\{s\.contactMasque \? '' : `<div class="vw-row"><span class="vw-label">Contact<\/span>/, carte);
  }
});

/* Audit des données sensibles (9 oct. 2026, décisions du propriétaire). */
test('numéros : seule la ligne principale d’une clinique reste dans les textes libres', () => {
  const { masquerTelephones, PUBLIER_TELEPHONES } = require('./masquer-courriels.js');
  assert.equal(PUBLIER_TELEPHONES, false);
  assert.equal(masquerTelephones('Téléphone de la clinique : 450 347-5548. Recrutement : Dre X, 438 497-1537.'),
    'Téléphone de la clinique : 450 347-5548. Recrutement : Dre X, À venir.');
  assert.equal(masquerTelephones('Téléphone : 450 244-5350. Cellulaire : (514) 293-8000 poste 12'),
    'Téléphone : 450 244-5350. Cellulaire : À venir');
  const apres = masquerCourriels({ telephone: '450 468-5511', site: 'https://exemple.ca/4503475548', infos: 'Dr Y, 514-555-1234' });
  assert.equal(apres.telephone, '450 468-5511');
  assert.equal(apres.site, 'https://exemple.ca/4503475548');
  assert.equal(apres.infos, 'Dr Y, À venir');
});

test('JSON publiés : ni fiches masquées, ni numéros personnels, ni traces internes', () => {
  const { masquerTelephones } = require('./masquer-courriels.js');
  const publie = nom => donneesPubliques(fs.readFileSync(path.join(RACINE, nom), 'utf8'));
  const data = JSON.parse(publie('data.json'));
  assert.ok(data.cliniques.length > 50);
  for (const c of data.cliniques) {
    assert.notEqual(c.visible, false, `fiche masquée publiée : ${c.id}`);
    for (const champ of ['notes', 'sourceRepertoire', 'raisonMasquage']) assert.ok(!(champ in c), `${champ} publié : ${c.id}`);
    if (c.region === 'Centre' && c.rls === 'Haut-Richelieu–Rouville') assert.ok(!('infos' in c), `infos HRR publiées : ${c.id}`);
  }
  for (const nom of FICHIERS_DONNEES) {
    const texte = publie(nom);
    assert.doesNotMatch(texte, /Olivier/, nom);
    const restes = [];
    const parcourir = (o, cle) => {
      if (typeof o === 'string') {
        if (cle !== 'telephone' && !/^\s*https?:\/\//i.test(o) && masquerTelephones(o) !== o) restes.push(o.slice(0, 80));
      } else if (Array.isArray(o)) o.forEach(v => parcourir(v, cle));
      else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) parcourir(v, k);
    };
    const json = JSON.parse(texte);
    parcourir(json, '');
    assert.deepEqual(restes, [], nom);
    if (json.meta) {
      for (const champ of ['sourceDocument', 'champsRetires', 'projectionPublique', 'statutValidation']) assert.ok(!(champ in json.meta), `${nom} : meta.${champ}`);
      const pol = json.meta.politiqueAffichage || {};
      assert.ok(!('note' in pol) && !('champsInternes' in pol), `${nom} : notes de politiqueAffichage`);
      assert.ok('afficherResponsableNom' in pol, `${nom} : réglages d'affichage gardés pour la carte`);
    }
  }
});

test('export du classeur (PTEM2027_v2.gs) : courriels et numéros personnels remplacés', () => {
  const vm = require('node:vm');
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RACINE, 'PTEM2027_v2.gs'), 'utf8'), ctx);
  assert.match(ctx.PTEM2.version, /^v5-/);
  assert.equal(ctx.PTEM2.publierTelephones, false);
  const compte = { n: 0, tel: 0 };
  const r = ctx.masquerCourrielsExport_({ infos: 'Téléphone : 450 244-5350. Recrutement : Dre X, 438 497-1537, x@y.ca', evenement: { telephone: '450 468-5511' } }, '', compte);
  /* publierCourriels: true (accord du propriétaire pour la carte) : l'export garde les courriels. */
  const courriels = ctx.PTEM2.publierCourriels;
  assert.equal(r.infos, 'Téléphone : 450 244-5350. Recrutement : Dre X, À venir, ' + (courriels ? 'x@y.ca' : 'À venir'));
  assert.equal(r.evenement.telephone, '450 468-5511');
  assert.deepEqual({ n: compte.n, tel: compte.tel }, { n: courriels ? 0 : 1, tel: 1 });
});

/* 10 oct. 2026 (décision du propriétaire) : adresse du recrutement médical du CISSS de la
   Montérégie-Est sur les fiches de l'Est du site ; la carte n'est pas touchée. */
test('Est : adresse du recrutement médical du CISSS sur toutes les fiches de cliniques et d’établissements', () => {
  /* Toutes les fiches de cliniques de l'Est (les GMF-U, dont la page renvoie vers leur fiche
     d'établissement, sont vérifiées avec les établissements ci-dessous). */
  const fiches = fs.readdirSync(path.join(RACINE, 'monteregie-est/cliniques'))
    .map(d => path.join(RACINE, 'monteregie-est/cliniques', d, 'index.html'))
    .filter(f => fs.existsSync(f))
    .map(f => fs.readFileSync(f, 'utf8'))
    .filter(h => !h.includes('Page déplacée'));
  assert.ok(fiches.length >= 25, `${fiches.length} fiches de cliniques de l'Est`);
  for (const h of fiches) assert.match(h, new RegExp(`<dt>Contact recrutement</dt><dd><a href="mailto:${COURRIEL_CISSS_EST.replace(/\./g, '\\.')}">`));
  const etabs = fs.readdirSync(path.join(RACINE, 'monteregie-est/etablissements'))
    .map(d => path.join(RACINE, 'monteregie-est/etablissements', d, 'index.html'))
    .filter(f => fs.existsSync(f))
    .flatMap(f => fs.readFileSync(f, 'utf8').match(/<p>Contact :[^\n]*<\/p>/g) || []);
  assert.ok(etabs.length > 0);
  for (const ligne of etabs) assert.ok(ligne.includes(`mailto:${COURRIEL_CISSS_EST}`) && !ligne.includes(A_VENIR), ligne);
  const ptem = fs.readFileSync(path.join(RACINE, 'monteregie-est/ptem/index.html'), 'utf8');
  assert.ok(ptem.includes(`mailto:${COURRIEL_CISSS_EST}`) && ptem.includes(`mailto:${COURRIEL_CISSS_OUEST}`), 'page PTEM');
  if (!PUBLIER_COURRIELS_CARTE) {
    for (const fichier of FICHIERS_DONNEES) {
      assert.doesNotMatch(publieHorsExceptions(fs.readFileSync(path.join(RACINE, fichier), 'utf8')), /@ssss\.gouv\.qc\.ca/, `${fichier} : la carte reste sans courriel`);
    }
  }
});

/* 13 oct. 2026 (accord du propriétaire) : courriels des responsables du recrutement réaffichés pour
   les cliniques de l'Est, sur les deux cartes ; Centre et Ouest gardent « À venir ». Le test compte
   les fiches, il n'écrit aucune adresse. */
test('cartes : courriels des cliniques de l’Est publiés, aucun pour les autres régions', () => {
  const data = JSON.parse(donneesPubliques(fs.readFileSync(path.join(RACINE, 'data.json'), 'utf8')));
  const avec = c => contientCourriel(JSON.stringify(c));
  const est = data.cliniques.filter(regionPubliee);
  const autres = data.cliniques.filter(c => !regionPubliee(c));
  assert.ok(est.filter(avec).length >= 20, `${est.filter(avec).length} cliniques de l'Est avec un courriel publié`);
  assert.deepEqual(autres.filter(avec).map(c => c.id), [], 'cliniques hors Est avec un courriel publié');
  const injecte = masquer({ cliniques: [{ region: 'Est', personneRessource: 'a@exemple.ca' }] }, '', false);
  assert.equal(injecte.cliniques[0].personneRessource, A_VENIR, 'masquer seul ne connaît pas l’exception');
  const { masquerPourCarte } = require('./masquer-courriels.js');
  const carte = masquerPourCarte({ annonce: { lien: 'mailto:b@exemple.ca' }, cliniques: [
    { region: 'Est', personneRessource: 'a@exemple.ca' }, { region: 'Centre', personneRessource: 'c@exemple.ca' },
    { region: 'Est', personneRessource: 'd@exemple.ca', contactMasque: true }] });
  assert.equal(carte.cliniques[0].personneRessource, PUBLIER_COURRIELS_CARTE || regionPubliee({ region: 'Est' }) ? 'a@exemple.ca' : A_VENIR);
  assert.equal(carte.cliniques[1].personneRessource, PUBLIER_COURRIELS_CARTE ? 'c@exemple.ca' : A_VENIR);
  assert.equal(carte.cliniques[2].personneRessource, '', 'contactMasque l’emporte toujours');
  assert.equal(carte.annonce.lien, PUBLIER_COURRIELS_CARTE ? 'mailto:b@exemple.ca' : '', 'annonce : interrupteur général');
  assert.deepEqual(Object.keys(carte), ['annonce', 'cliniques'], 'ordre des clés gardé');
});

/* 14 oct. 2026 (choix du propriétaire) : les courriels des responsables de l'Est s'affichent sur la
   carte de l'Est seulement. La carte /monteregie/ remplace, au chargement des données, ceux des
   cliniques et des secteurs de l'Est par l'adresse générale du recrutement de l'Est. */
test('carte /monteregie/ : adresse générale du recrutement pour les contacts de l’Est', () => {
  const mtg = fs.readFileSync(path.join(RACINE, 'monteregie/index.html'), 'utf8');
  const est = fs.readFileSync(path.join(RACINE, 'monteregie-est/index.html'), 'utf8');
  assert.ok(mtg.includes(`const COURRIEL_RECRUTEMENT_EST = '${COURRIEL_CISSS_EST}';`));
  assert.match(mtg, /initData\(courrielsGenerauxEst\(data\), fusionnerEtablissements\(etabEst, etabCentre\)\)/);
  assert.match(mtg, /if \(c\.region === 'Est' && !c\.contactMasque\) c\.personneRessource = COURRIEL_RECRUTEMENT_EST;/);
  assert.match(mtg, /sec\.responsableCourriel = COURRIEL_RECRUTEMENT_EST;/);
  assert.doesNotMatch(est, /courrielsGenerauxEst|COURRIEL_RECRUTEMENT_EST/, 'la carte de l’Est garde les courriels');
});

/* 14 oct. 2026 (accord explicite du propriétaire) : courriels des départements de l'Est, transmis
   par le recrutement médical de Santé Québec Montérégie-Est, publiés dans les données de la carte.
   Les fiches du site gardent l'adresse générale (test plus haut). Le test compte, sans écrire
   d'adresse. */
test('carte de l’Est : courriels des secteurs de l’Est publiés, aucun pour le Centre', () => {
  const est = JSON.parse(donneesPubliques(fs.readFileSync(path.join(RACINE, 'data-etablissements.json'), 'utf8')));
  const centre = JSON.parse(donneesPubliques(fs.readFileSync(path.join(RACINE, 'data-etablissements-centre.json'), 'utf8')));
  assert.equal(est.regionApplication, 'Est');
  assert.equal(est.meta.politiqueAffichage.afficherResponsableCourriel, true);
  const avec = est.secteurs.filter(s => contientCourriel(s.responsableCourriel || ''));
  assert.equal(avec.length, est.secteurs.length, 'chaque secteur de l’Est a une adresse');
  const generale = avec.filter(s => s.responsableCourriel === COURRIEL_CISSS_EST).length;
  assert.ok(generale >= 1 && generale < avec.length / 2, `${generale} secteurs à l’adresse générale`);
  assert.doesNotMatch(JSON.stringify(est.installations), /@/, 'installations sans courriel');
  assert.doesNotMatch(JSON.stringify(centre.secteurs), /@/, 'secteurs du Centre sans courriel');
  const { masquerPourCarte } = require('./masquer-courriels.js');
  const essai = masquerPourCarte({ regionApplication: 'Est', meta: { note: 'a@exemple.ca' },
    secteurs: [{ responsableCourriel: 'b@exemple.ca' }, { responsableCourriel: 'c@exemple.ca', contactMasque: true }] });
  assert.equal(essai.secteurs[0].responsableCourriel, 'b@exemple.ca');
  assert.equal(essai.secteurs[1].responsableCourriel, '', 'contactMasque l’emporte toujours');
  assert.doesNotMatch(JSON.stringify(essai.meta), /a@exemple\.ca/, 'le reste du fichier reste masqué');
});
