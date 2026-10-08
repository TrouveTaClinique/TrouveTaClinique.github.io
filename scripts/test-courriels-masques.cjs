'use strict';
/* Courriels retirés du site le 8 oct. 2026, « jusqu'à nouvel ordre » (scripts/masquer-courriels.js).
   Le test lit les fichiers tels qu'ils sont publiés (liste blanche de preparer-apercu.js, JSON de
   données filtrés par donneesPubliques) : un export du classeur qui remettrait des courriels dans
   data.json ne bloque donc pas le robot, mais une page ou un fichier publié qui en afficherait un,
   oui. Seule adresse permise : celle du site. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  PUBLIER_COURRIELS, A_VENIR, masquerCourriels, masquerTexte, contientCourriel
} = require('./masquer-courriels.js');
const { lister, donneesPubliques, FICHIERS_DONNEES, RACINE } = require('./preparer-apercu.js');

const PERMISES = new Set(['contact@trouvetaclinique.ca']);
const RE_COURRIEL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const TEXTE = /\.(html|json|js|xml|txt|webmanifest|css|csv|md)$/i;

test('les courriels restent retirés jusqu\'à nouvel ordre', () => {
  assert.equal(PUBLIER_COURRIELS, false);
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
  const apres = masquerCourriels(avant);
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
});

test('aucun fichier publié ne contient un autre courriel que celui du site', () => {
  const trouves = [];
  for (const fichier of lister(RACINE)) {
    if (!TEXTE.test(fichier)) continue;
    let texte = fs.readFileSync(path.join(RACINE, fichier), 'utf8');
    if (FICHIERS_DONNEES.has(fichier)) texte = donneesPubliques(texte);
    for (const m of texte.match(RE_COURRIEL) || []) {
      const adresse = m.toLowerCase();
      if (PERMISES.has(adresse) || /\.(png|jpe?g|webp|svg|gif|js|css)$/.test(adresse)) continue;
      trouves.push(`${fichier} : ${m}`);
    }
  }
  assert.deepEqual(trouves, []);
});

test('les JSON publiés ne gardent aucun courriel, même si data.json en recevait', () => {
  for (const fichier of FICHIERS_DONNEES) {
    const brut = JSON.parse(fs.readFileSync(path.join(RACINE, fichier), 'utf8'));
    if (brut.cliniques) brut.cliniques[0].personneRessource = 'quelquun@gmail.com';
    if (brut.secteurs) brut.secteurs[0].recrutement = { responsableCourriel: 'quelquun@gmail.com' };
    brut.meta = { ...(brut.meta || {}), note: 'Écrire à quelquun@gmail.com' };
    const publie = donneesPubliques(JSON.stringify(brut));
    assert.doesNotMatch(publie, /quelquun@gmail\.com/, fichier);
  }
});
