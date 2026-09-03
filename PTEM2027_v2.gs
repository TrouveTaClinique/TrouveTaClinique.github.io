/**
 * PTEM 2027 — Montérégie · classeur maître v2
 * Version : v2-2026-09-02
 *
 * Départ à neuf. Aucune migration, aucune table LEGACY, aucune donnée figée
 * dans le script : les fiches sont lues depuis le data.json publié.
 *
 * RÈGLE ABSOLUE : ce script n'envoie aucun courriel, ne partage aucun fichier
 * et ne publie rien. genererDataJson_ produit le fichier dans un onglet, pour
 * inspection. La publication vers GitHub reste une étape manuelle.
 *
 * Runtime V8 obligatoire.
 *
 * À exécuter une seule fois, sur un classeur NEUF et VIDE : initialiserV2
 *
 * Correctifs du 2 septembre 2026 (audit Main/Brouillon) :
 *   - URL de référence pointant vers le dépôt officiel TrouveTaClinique ;
 *   - échec de lecture de la référence = refus d'export (plus un simple avertissement) ;
 *   - conservation du tableau hopitaux et des champs absents du classeur ;
 *   - les courriels de recrutement (personneRessource) sont conservés volontairement.
 */

var PTEM2 = {
  version: 'v2-2026-09-02',
  titreClasseur: 'PTEM 2027 — Base maître des cliniques de la Montérégie',
  sourceDataJson: 'https://raw.githubusercontent.com/TrouveTaClinique/TrouveTaClinique.github.io/main/data.json',
  propVersion: 'PTEM2027_V2_VERSION',
  propAmorce: 'PTEM2027_V2_AMORCE',
  fMaitre: 'Cliniques maître',
  fListes: 'Listes',
  fSuivi: 'Suivi',
  fRevision: 'Révision',
  fJournal: 'Journal',
  fExport: 'Export data.json',
  fInstantanes: 'Instantané',   // préfixe des onglets de sauvegarde
  joursInstantanes: 30,
  seuilBaisse: 0.10,            // refus de publier si > 10 % des fiches disparaissent
  dossierExports: 'PTEM 2027 — exports',
  exportsConserves: 10,         // nombre de fichiers d'export gardés dans le Drive
  maxCellule: 45000             // marge sous la limite de 50 000 caractères par cellule
};

var RLS = ['Champlain','Haut-Richelieu–Rouville','Haut-Saint-Laurent','Jardins-Roussillon',
  'Pierre-Boucher','Pierre-De Saurel','Richelieu-Yamaska','Suroît','Vaudreuil-Soulanges','Autre'];

var PUBLICATION = ['Publiée','Masquée','Non publiée'];

var STATUTS = ['À valider','Envoyé à la clinique','Réponse reçue','Validé','À corriger','Archivé'];

var JOURS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
var CLES_JOURS = ['q44_monday','q45_tuesday','q46_wednesday','q47_thursday','q48_friday','q49_saturday','q50_sunday'];

/* =====================================================================
 * TABLES DE CORRESPONDANCE carte <-> classeur
 * Vérifiées sur les 58 fiches : l'aller-retour est sans perte.
 * ATTENTION : `type` et les codes de `pratiques` sont des CODES que
 * l'application recherche dans TYPE_COLORS / TYPE_LABELS / PRATIQUES.
 * Ne jamais les remplacer par des libellés lisibles.
 * ===================================================================== */

// clé data.json  <->  clé du formulaire. L'ordre fixe ici détermine l'ordre
// d'affichage du personnel dans les fiches de la carte.
var PERSONNEL = [
  ['medecins','q54_family_doctors'], ['residents','q55_residents'],
  ['specialistes','q56_specialists'], ['ipspl','q57_ipspl'],
  ['infirmieres','q58_nurses'], ['infauxiliaires','q59_aux_nurses'],
  ['physiotherapeutes','q61_physios'],
  ['pharmaciennes','q62_pharmacists'], ['nutritionnistes','q63_dietitians'],
  ['psychologues','q64_psychologists'], ['travailleuresSociales','q65_social_workers'],
  ['intervenantspsychosociaux','q66_psychosocial']
];

var PRATIQUES = [
  ['pec','Prise en charge et suivi longitudinal — PEC'],
  ['gap','Guichet d’accès à la première ligne — GAP'],
  ['sad','Soins à domicile — SAD'],
  ['peri','Périnatalité — PÉRI'],
  ['msk','Musculosquelettique — MSK'],
  ['chir','Chirurgie mineure — CHIR']
];

var DME = [
  ['Myle (Medfar Solutions)','Myle — Medfar Solutions'],
  ['Medesync (Telus)','Medesync — TELUS'],
  ['Omnimed','Omnimed'], ['Ofys','Ofys'], ['MobileMed','MobileMed'],
  ['KinLogix','KinLogix'], ['Purkinje','Purkinje'], ['À compléter','À confirmer']
];

var REGION = [['Est','Montérégie-Est'],['Centre','Montérégie-Centre'],['Ouest','Montérégie-Ouest']];

var TYPE = [['GMF','GMF'],['GMF-U','GMF-U'],['GMF-R','GMF-R'],
  ['CLSC','CLSC'],['Clinique médicale','Clinique médicale'],['Coopérative','Coopérative'],['CH','Autre'],
  ['GMF satellite','GMF']]; // ancien type, converti en GMF le 11 août 2026
var TYPE_AUTRE = {'CH':'Centre hospitalier'};
// Une clinique peut cocher plusieurs types (Q10) mais la carte n'accepte qu'un
// seul code : il détermine la couleur du marqueur et le rang de tri.
// On retient le plus spécifique.
var TYPE_PRIORITE = ['GMF-U','GMF-R','GMF','CLSC','Coopérative','Clinique médicale'];
var TYPE_NORM  = {'Clinique':'Clinique médicale', 'GMF satellite':'GMF'};

// Vocabulaire du formulaire depuis le 10 août 2026 : trois options de bureau
// seulement. L'ancien vocabulaire (dédié ou attitré / partagé, selon les
// disponibilités) reste reconnu en lecture, pour les 58 fiches amorcées avant
// ce changement.
var BUREAU = [
  ['Bureau dédié', 'Bureau attitré'],
  ['Bureau partagé', 'Bureau partagé'],
  ['Bureau dédié ou partagé', 'Bureau attitré; Bureau partagé']
];
var BUREAU_RETOUR = {
  'Bureau attitré':'Bureau dédié',
  'Bureau partagé':'Bureau partagé',
  'Bureau attitré; Bureau partagé':'Bureau dédié ou partagé',
  // vocabulaire d'avant le 10 août 2026, encore présent dans les fiches amorcées
  'Bureau dédié ou attitré':'Bureau dédié',
  'Bureau partagé, selon les disponibilités':'Bureau partagé',
  'Bureau dédié ou attitré; Bureau partagé, selon les disponibilités':'Bureau dédié ou partagé'
};
var FRAIS = [['Société de dépense','Société de partage des dépenses'],
  ['Aucun frais','Aucun frais'], ['Frais fixe','Autre']];
var FRAIS_RETOUR = {'Société de partage des dépenses':'Société de dépense','Aucun frais':'Aucun frais'};

/**
 * Réduit une réponse à cases multiples en une valeur unique pour la carte.
 * Les combinaisons connues gardent leur libellé court; toute autre réponse est
 * conservée telle quelle plutôt que perdue.
 */
function reduireCases_(brut, tableRetour) {
  brut = String(brut || '').trim();
  if (!brut) return '';
  if (tableRetour[brut] !== undefined) return tableRetour[brut];
  return brut.split(/\s*;\s*/).filter(function(x) { return x; }).join(' · ');
}

function typeCarte_(mirroir, cases, precision) {
  if (String(mirroir || '').trim()) return String(mirroir).trim();
  var choix = String(cases || '').split(/\s*;\s*/).map(function(x) { return x.trim(); });
  for (var i = 0; i < TYPE_PRIORITE.length; i++) {
    if (choix.indexOf(TYPE_PRIORITE[i]) !== -1) return TYPE_PRIORITE[i];
  }
  if (choix.indexOf('Autre') !== -1) {
    return /h[oô]pital|hospitalier/i.test(String(precision || '')) ? 'CH' : 'Clinique médicale';
  }
  return '';
}

function chercher_(table, valeur, defaut) {
  for (var i = 0; i < table.length; i++) if (table[i][0] === valeur) return table[i][1];
  return defaut === undefined ? '' : defaut;
}
function inverser_(table) {
  return table.map(function(p) { return [p[1], p[0]]; });
}

/* =====================================================================
 * COLONNES DU CLASSEUR
 * ===================================================================== */

var ADMIN_COLUMNS = [
  {key:'id', title:'ID stable'},
  {key:'rls', title:'RLS'},
  {key:'subregion', title:'Sous-région'},
  {key:'region', title:'Région administrative'},
  {key:'validation_status', title:'Statut de validation'},
  {key:'sent_date', title:'Date d’envoi'},
  {key:'response_date', title:'Date de réponse'},
  {key:'last_validation', title:'Dernière vérification'},
  {key:'update_source', title:'Source de mise à jour'},
  {key:'latitude', title:'Latitude'},
  {key:'longitude', title:'Longitude'},
  {key:'position_precision', title:'Précision de la position'},
  {key:'prefill_url', title:'Lien prérempli'},
  {key:'edit_response_url', title:'Lien de modification de la réponse'},
  {key:'last_response_timestamp', title:'Dernier horodatage de réponse'},
  {key:'q2_alias', title:'Alias et anciens noms (interne)'},
  {key:'publication', title:'Publication'},
  {key:'source_notes', title:'Notes internes'}
];

// Colonnes miroir : champs de la carte sans équivalent dans le formulaire.
// Elles garantissent que l'aller-retour reste sans perte.
var CARTE_COLUMNS = [
  {key:'carte_type', title:'[carte] code de type'},
  {key:'carte_notes', title:'[carte] notes'}
];

var FORM_FIELDS = [
  {key:'q1_name', title:'1. Nom officiel de votre établissement', type:'text', required:true},
  {key:'q3_rls', title:'2. Réseau local de services (RLS)', type:'list', required:true, options:RLS},
  {key:'q4_respondent_name', title:'3. Nom de la personne remplissant le formulaire', type:'text', required:true},
  {key:'q8_recruitment', title:'4. Votre établissement recrute-t-il actuellement des médecins de famille dans le cadre du PTEM 2027?', type:'multiple', required:true, options:['Oui, le recrutement est actif','Le recrutement est envisagé, mais n’est pas encore confirmé','Non, l’établissement ne recrute pas actuellement','Je ne sais pas ou cette information reste à confirmer']},
  {key:'q9_map', title:'5. Souhaitez-vous que votre établissement apparaisse sur la carte interactive?', type:'multiple', required:true, options:['Oui','Je souhaite d’abord en discuter','Non']},
  {key:'q10_types', title:'6. Type d’établissement', type:'checkbox', required:true, options:['GMF','GMF-U','GMF-R','CLSC','Clinique médicale','Coopérative','Autre']},
  {key:'q11_type_other', title:'7. Si vous avez sélectionné « Autre » au type d’établissement, veuillez préciser', type:'text'},
  {key:'q12_website', title:'8. Site web de l’établissement', type:'text'},
  {key:'q15_address', title:'9. Adresse complète', type:'text'},
  {key:'q16_city', title:'10. Ville', type:'text'},
  {key:'q19_recruit_email', title:'11. Adresse courriel pour le recrutement', type:'text', validation:'email', help:'Il s’agit de l’adresse qui sera affichée sur la carte interactive.'},
  {key:'q22_doctors_sought', title:'12. Nombre approximatif de médecins de famille recherchés', type:'text'},
  {key:'q24_commitment', title:'13. Engagement minimal ou idéal recherché', type:'text', help:'Exemple : nombre de demi-journées par semaine.'},
  {key:'q25_gmf_level', title:'14. Niveau GMF, si applicable', type:'text'},
  {key:'q25_gmfu_level', title:'15. Niveau GMF-U, si applicable', type:'text'},
  {key:'q25_access_level', title:'16. Niveau GMF accès-réseau, si applicable', type:'text'},
  {key:'q26_emrs', title:'17. Dossier Médical Électronique (DMÉ) utilisé', type:'checkbox', options:['Myle — Medfar Solutions','Medesync — TELUS','Omnimed','Ofys','MobileMed','KinLogix','Purkinje','Aucun','À confirmer','Autre']},
  {key:'q27_emr_other', title:'18. Si vous avez sélectionné « Autre » au DMÉ, veuillez préciser', type:'text'},
  {key:'q28_offices', title:'19. Types de bureaux pouvant être offerts au nouveau médecin', type:'checkbox', options:['Bureau attitré','Bureau partagé','Autre']},
  {key:'q29_office_other', title:'20. Si vous avez sélectionné « Autre » au bureau, veuillez préciser', type:'text'},
  {key:'q30_fees', title:'21. Modalités possibles des frais de bureau ou de la contribution aux dépenses', type:'checkbox', options:['Tarif horaire','Tarif à la demi-journée','Tarif à la journée complète','Tarif au mois','Tarif à l’année','Pourcentage des revenus','Société de partage des dépenses','Aucun frais','Autre']},
  {key:'q31_fee_other', title:'22. Si vous avez sélectionné « Autre » aux frais, veuillez préciser la modalité', type:'text'},
  {key:'qproximite', title:'23. Services à proximité, dans le même bâtiment', type:'checkbox', options:['Clinique de radiologie','Centre de prélèvement','Pharmacie','Clinique de physiothérapie','Clinique d’ergothérapie','Clinique d’audiologie','Autre']},
  {key:'qproximite_autre', title:'24. Si vous avez sélectionné « Autre » aux services à proximité, veuillez préciser', type:'text'},
  {key:'q33_practices', title:'25. Types de pratique que le nouveau médecin pourra exercer à l’établissement', type:'checkbox', options:['Prise en charge et suivi longitudinal — PEC','Guichet d’accès à la première ligne — GAP','Soins à domicile — SAD','Périnatalité — PÉRI','Musculosquelettique — MSK','Chirurgie mineure — CHIR','Autre']},
  {key:'q34_practice_other', title:'26. Si vous avez sélectionné « Autre » aux pratiques, veuillez préciser', type:'paragraph'},
  {key:'q38_open_house', title:'27. Une activité portes ouvertes est-elle prévue? (si oui, écrire la date / période prévue)', type:'text'},
  {key:'qgarde_labo', title:'28. Couverture des résultats durant absence des médecins', type:'multiple', options:['Garde labo par infirmière','Garde labo par médecin','Autre']},
  {key:'qgarde_urgence', title:'29. Fréquence de garde urgence mineure / accès adapté, si applicable', type:'text'},
  {key:'qgarde_autre', title:'30. Autre type de garde, si applicable', type:'paragraph', help:'Exemple : présence au bureau de soir ou fin de semaine.'},
  {key:'q44_monday', title:'31. Lundi', type:'text'},
  {key:'q45_tuesday', title:'32. Mardi', type:'text'},
  {key:'q46_wednesday', title:'33. Mercredi', type:'text'},
  {key:'q47_thursday', title:'34. Jeudi', type:'text'},
  {key:'q48_friday', title:'35. Vendredi', type:'text'},
  {key:'q49_saturday', title:'36. Samedi', type:'text'},
  {key:'q50_sunday', title:'37. Dimanche', type:'text'},
  {key:'q51_hours_notes', title:'38. Précisions concernant l’horaire', type:'paragraph'},
  {key:'q54_family_doctors', title:'39. Médecins de famille', type:'text', validation:'nonnegative_integer'},
  {key:'q55_residents', title:'40. Résidents en médecine', type:'text', validation:'nonnegative_integer'},
  {key:'q56_specialists', title:'41. Médecins spécialistes', type:'text', validation:'nonnegative_integer'},
  {key:'q57_ipspl', title:'42. IPS-PL', type:'text', validation:'nonnegative_integer'},
  {key:'q58_nurses', title:'43. Infirmières cliniciennes', type:'text', validation:'nonnegative_integer'},
  {key:'q59_aux_nurses', title:'44. Infirmières auxiliaires', type:'text', validation:'nonnegative_integer'},
  {key:'q61_physios', title:'45. Physiothérapeutes', type:'text', validation:'nonnegative_integer'},
  {key:'q62_pharmacists', title:'46. Pharmaciens', type:'text', validation:'nonnegative_integer'},
  {key:'q63_dietitians', title:'47. Nutritionnistes', type:'text', validation:'nonnegative_integer'},
  {key:'q64_psychologists', title:'48. Psychologues', type:'text', validation:'nonnegative_integer'},
  {key:'q65_social_workers', title:'49. Travailleuses sociales', type:'text', validation:'nonnegative_integer'},
  {key:'q66_psychosocial', title:'50. Autres intervenants psychosociaux', type:'text', validation:'nonnegative_integer'},
  {key:'q68_other_professionals', title:'51. Autres professionnels présents dans l’équipe', type:'paragraph', validation:'max200', help:'Maximum : 200 caractères.'},
  {key:'q69_profile', title:'52. Qu’aimeriez-vous que les résidents sachent à propos de votre établissement?', type:'paragraph', validation:'max600', help:'Maximum : 600 caractères. Vous pouvez notamment décrire l’ambiance de travail, la patientèle, les particularités de l’établissement, les mesures d’accueil et d’accompagnement offertes au nouveau médecin (mentorat, soutien administratif, formation au DMÉ, intégration à l’équipe), l’accessibilité ou le stationnement. Cette réponse sera publiée sur la carte.'},
  {key:'q71_feedback', title:'53. Avez-vous des recommandations, des commentaires ou des idées d’amélioration concernant la carte interactive?', type:'paragraph'}
];

function colonnes_() {
  return ADMIN_COLUMNS.concat(CARTE_COLUMNS).concat(FORM_FIELDS.map(function(f) {
    return {key:f.key, title:f.title};
  }));
}
function titreChamp_(key) {
  return champParCle_(key).title;
}

function champParCle_(key) {
  for (var i = 0; i < FORM_FIELDS.length; i++) if (FORM_FIELDS[i].key === key) return FORM_FIELDS[i];
  throw new Error('Champ introuvable : ' + key);
}

/**
 * Les en-têtes de « Cliniques maître » sont figées au moment de l'amorçage.
 * Chaque fois que le formulaire est modifié depuis (question ajoutée,
 * retirée, reformulée), le numéro affiché dans FORM_FIELDS change, mais
 * l'en-tête déjà écrite dans le classeur ne bouge pas d'elle-même. Sans ça,
 * une simple recherche exacte du titre échoue silencieusement ou lève une
 * erreur, même si la question existe toujours.
 *
 * titreSansNumero_ retire le numéro pour comparer sur le texte seul.
 * ANCIENS_LIBELLES couvre les quelques questions dont le TEXTE a aussi changé
 * (pas seulement le numéro), pour les retrouver malgré la reformulation.
 */
function titreSansNumero_(t) {
  return String(t || '').replace(/^\d+\.\s*/, '').trim();
}

var ANCIENS_LIBELLES = {
  q1_name: ['Nom officiel de la clinique ou de l’installation'],
  q8_recruitment: ['Votre milieu recrute-t-il actuellement des médecins de famille dans le cadre du PTEM 2027?'],
  q9_map: ['Souhaitez-vous que votre milieu apparaisse sur la carte interactive?'],
  q10_types: ['Type ou désignation du milieu'],
  q11_type_other: ['Si vous avez sélectionné « Autre » au type de milieu, veuillez préciser'],
  q12_website: ['Site Web de la clinique ou de l’installation'],
  q19_recruit_email: ['Courriel de recrutement pouvant être affiché sur la carte'],
  q25_gmf_level: ['Niveau GMF actuel, si applicable'],
  q25_access_level: ['Niveau accès-réseau actuel, si applicable'],
  q25_gmfu_level: ['Niveau GMF-U actuel, si applicable'],
  q26_emrs: ['Dossier ou dossiers médicaux électroniques utilisés'],
  q28_offices: ['Type ou types de bureaux pouvant être offerts au nouveau médecin'],
  q33_practices: ['Types de pratique que le nouveau médecin pourra réellement exercer à la clinique',
                  'Types de pratique que le nouveau médecin pourra exercer à la clinique'],
  q38_open_house: ['Une activité portes ouvertes est-elle prévue?'],
  qgarde_labo: ['Fréquence de la garde labo, si applicable'],
  qgarde_urgence: ['Fréquence de la garde d’urgence mineure, si applicable'],
  q62_pharmacists: ['Pharmaciennes ou pharmaciens'],
  q65_social_workers: ['Travailleuses ou travailleurs sociaux'],
  q66_psychosocial: ['Autres intervenantes ou intervenants psychosociaux'],
  q69_profile: ['Qu’aimeriez-vous que les résidents sachent à propos de votre milieu?']
};

// Deux questions retirées du formulaire aujourd'hui, mais dont le classeur
// garde déjà des données réelles : à retrouver par texte brut pour migration,
// jamais par titreChamp_ puisqu'elles n'existent plus dans FORM_FIELDS.
var ANCIENS_LIBELLES_RETIRES = {
  courrielSuivi: ['Adresse courriel pour le suivi administratif'],
  telephone: ['Numéro de téléphone principal'],
  entreeEnFonction: ['Date ou période souhaitée d’entrée en fonction']
};

/**
 * Retrouve la colonne d'une question ENCORE PRÉSENTE dans FORM_FIELDS, quel
 * que soit son numéro actuel dans l'en-tête du classeur. Si trouvée par une
 * voie de repli, l'en-tête est immédiatement corrigée pour refléter le
 * libellé exact d'aujourd'hui : les appels suivants retombent sur une
 * correspondance directe.
 */
function colonneParCle_(sheet, entetes, key) {
  var titreActuel = titreChamp_(key);
  var i = entetes.indexOf(titreActuel);
  if (i !== -1) return i + 1;

  var cible = titreSansNumero_(titreActuel);
  for (var k = 0; k < entetes.length; k++) {
    if (titreSansNumero_(entetes[k]) === cible) {
      sheet.getRange(1, k + 1).setValue(titreActuel);
      entetes[k] = titreActuel;
      return k + 1;
    }
  }
  var anciens = ANCIENS_LIBELLES[key] || [];
  for (var a = 0; a < anciens.length; a++) {
    var c2 = titreSansNumero_(anciens[a]);
    for (var k2 = 0; k2 < entetes.length; k2++) {
      if (titreSansNumero_(entetes[k2]) === c2) {
        sheet.getRange(1, k2 + 1).setValue(titreActuel);
        entetes[k2] = titreActuel;
        return k2 + 1;
      }
    }
  }
  return 0;
}

/**
 * Retrouve une colonne ORPHELINE (retirée de FORM_FIELDS, ex. une question
 * supprimée du formulaire) par son texte brut, sans numéro. Utile pour migrer
 * une dernière fois une donnée avant que la colonne ne reste inerte.
 */
function colonneBrute_(entetes, texteBrutSansNumero) {
  for (var k = 0; k < entetes.length; k++) {
    if (titreSansNumero_(entetes[k]) === texteBrutSansNumero) return k + 1;
  }
  return 0;
}

/**
 * Répare l'en-tête complète de « Cliniques maître » : chaque question encore
 * active dans FORM_FIELDS reçoit son libellé exact actuel, peu importe son
 * ancien numéro ou une reformulation connue. Idempotente — sans effet si tout
 * est déjà synchronisé. À exécuter après toute modification du formulaire, et
 * appelée automatiquement par les fonctions de correction et par l'export.
 */
function synchroniserEntetes_(sheet) {
  var entetes = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(v) { return String(v || '').trim(); });
  // Seules les vraies questions du formulaire dérivent de numéro d'une session
  // à l'autre. Les colonnes administratives (dont certaines ont, par hasard,
  // une clé commençant par « q », ex. q2_alias) restent fixes et ne doivent
  // jamais passer par titreChamp_, qui ne les connaît pas.
  var CLES_FORMULAIRE = {};
  FORM_FIELDS.forEach(function(f) { CLES_FORMULAIRE[f.key] = true; });

  var reparees = 0, creees = [];
  colonnes_().forEach(function(col) {
    if (!CLES_FORMULAIRE[col.key]) return;
    var avant2 = entetes.slice();
    var pos = colonneParCle_(sheet, entetes, col.key);

    // Colonne jamais créée physiquement : c'est le cas des questions ajoutées
    // au script après l'amorçage du classeur (gardes, services à proximité…).
    // On l'ajoute à droite plutôt que d'échouer : l'ordre des colonnes n'a
    // aucune importance, tout est retrouvé par titre.
    if (!pos) {
      var nouvelleCol = sheet.getLastColumn() + 1;
      if (sheet.getMaxColumns() < nouvelleCol) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), nouvelleCol - sheet.getMaxColumns());
      }
      sheet.getRange(1, nouvelleCol).setValue(col.title)
        .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#7F7F7F').setWrap(true);
      sheet.setColumnWidth(nouvelleCol, 170);
      entetes[nouvelleCol - 1] = col.title;
      creees.push(col.title);
      return;
    }
    if (avant2[pos - 1] !== col.title) reparees++;
  });
  if (creees.length) {
    console.log(creees.length + ' colonne(s) manquante(s) créée(s) à droite de la feuille : ' + creees.join(' | '));
  }
  return { reparees: reparees, creees: creees, manquantes: [] };
}


/* =====================================================================
 * MENU
 * ===================================================================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('PTEM 2027')
    .addItem('Actualiser le suivi', 'actualiserSuivi')
    .addItem('Préparer l’export data.json', 'preparerExport')
    .addItem('Créer un instantané maintenant', 'creerInstantane')
    .addSeparator()
    .addItem('Corriger les niveaux GMF (une seule fois)', 'corrigerNiveaux')
    .addItem('Corriger les pratiques (une seule fois)', 'corrigerPratiques')
    .addItem('Corriger les effectifs retirés du formulaire (une seule fois)', 'corrigerEffectifsRetires')
    .addItem('Nettoyer les contacts sans courriel (une seule fois)', 'corrigerContacts')
    .addItem('Actualiser les listes déroulantes', 'actualiserListes')
    .addItem('Synchroniser les en-têtes (après changement du formulaire)', 'synchroniserEntetes')
    .addItem('Appliquer la tournée Jardins-Roussillon du 10 août (une seule fois)', 'appliquerTourneeJardinsRoussillon')
    .addToUi();
  // initialiserV2 n'est volontairement PAS au menu : création initiale
  // uniquement, à lancer depuis l'éditeur Apps Script.
}

/* =====================================================================
 * CORRECTION PONCTUELLE DES NIVEAUX
 * À exécuter une seule fois si les colonnes de niveaux sont vides parce que
 * l'amorçage a lu un data.json déjà converti au nouveau format de libellé.
 * N'écrase jamais une valeur déjà saisie.
 * ===================================================================== */

// id de la carte -> [niveau GMF, niveau accès-réseau, niveau GMF-U]
var NIVEAUX_REFERENCE = {
  1:['17','',''],   2:['17','',''],   6:['12','4',''],  7:['','','2'],
  8:['4','',''],    9:['2','',''],   10:['7','',''],   11:['6','',''],
 14:['','','5'],   15:['3','',''],  16:['4','',''],   17:['14','',''],
 18:['11','',''],  19:['3','',''],  20:['7','',''],   21:['2','',''],
 22:['2','',''],   26:['5','',''],  27:['','3',''],   28:['','','À confirmer']
};

function corrigerNiveaux() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var maitre = ss.getSheetByName(PTEM2.fMaitre);
    if (!maitre) throw new Error('Onglet « ' + PTEM2.fMaitre + ' » introuvable.');

    instantaner_(ss, maitre);
    synchroniserEntetes_(maitre);

    var vals = maitre.getDataRange().getValues();
    var ent = vals[0].map(function(v) { return String(v || '').trim(); });
    var cId  = ent.indexOf('ID stable') + 1;
    var cGmf = colonneParCle_(maitre, ent, 'q25_gmf_level');
    var cAcc = colonneParCle_(maitre, ent, 'q25_access_level');
    var cGmu = colonneParCle_(maitre, ent, 'q25_gmfu_level');
    if (cId < 1 || cGmf < 1 || cAcc < 1 || cGmu < 1) {
      throw new Error('Colonnes de niveaux introuvables. Aucune donnée modifiée.');
    }

    var ecrits = 0, sautes = 0, journal = [];
    for (var i = 1; i < vals.length; i++) {
      var id = String(vals[i][cId - 1] || '').trim();
      var ref = NIVEAUX_REFERENCE[id];
      if (!ref) continue;
      var paires = [[cGmf, ref[0], 'GMF'], [cAcc, ref[1], 'accès-réseau'], [cGmu, ref[2], 'GMF-U']];
      for (var k = 0; k < paires.length; k++) {
        var col = paires[k][0], attendu = paires[k][1];
        if (!attendu) continue;
        var actuel = String(vals[i][col - 1] || '').trim();
        if (actuel === attendu) { sautes++; continue; }
        if (actuel !== '') {   // ne jamais écraser une saisie humaine
          journal.push('fiche ' + id + ' ' + paires[k][2] + ' : valeur existante « ' + actuel + ' » conservée');
          sautes++; continue;
        }
        maitre.getRange(i + 1, col).setValue(attendu);
        ecrits++;
      }
    }
    SpreadsheetApp.flush();
    console.log(ecrits + ' niveau(x) écrit(s), ' + sautes + ' inchangé(s).');
    journal.forEach(function(l) { console.warn(l); });
    journaliser_(ss, '', 'correction des niveaux', '', ecrits + ' valeurs', 'corrigerNiveaux');
    ss.toast(ecrits + ' niveaux écrits. Relancez « Préparer l’export data.json ».', 'PTEM 2027', 10);
  } finally {
    lock.releaseLock();
  }
}

/* =====================================================================
 * CORRECTION PONCTUELLE DES TYPES DE PRATIQUE
 * Aligne le classeur sur les corrections vérifiées du 5 août 2026 :
 *   - Azur perd PÉRI : le CISSS n'y liste qu'une médecin nommément, ce n'est
 *     pas une pratique offerte au milieu
 *   - Charles-Le Moyne et Saint-Hubert gagnent PÉRI (page « suivi de grossesse »
 *     de Santé Québec Montérégie-Centre)
 *   - les installations CLSC gagnent SAD
 * La Montérégie-Est n'est pas touchée : ses pratiques sont déjà confirmées
 * par les milieux.
 * ===================================================================== */

// id de la carte -> { ajouter: [...], retirer: [...] }
var PRATIQUES_CORRECTIONS = {
   4:{ajouter:['sad'],  retirer:[]},      // CLSC Longueuil-Ouest
  12:{ajouter:['sad'],  retirer:[]},      // CLSC des Patriotes
  13:{ajouter:['sad'],  retirer:[]},      // CLSC des Maskoutains
  23:{ajouter:['sad'],  retirer:[]},      // CLSC Gaston-Bélanger
  37:{ajouter:['peri'], retirer:[]},      // GMF-U Charles-Le Moyne
  38:{ajouter:[],       retirer:['peri']},// GMF-R Clinique Azur
  39:{ajouter:['sad'],  retirer:[]},      // GMF CLSC Samuel-De Champlain
  43:{ajouter:['peri'], retirer:[]},      // GMF-U Saint-Hubert
  51:{ajouter:['sad'],  retirer:[]}       // GMF Richelieu – Saint-Césaire (CLSC du Richelieu)
};

function corrigerPratiques() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var maitre = ss.getSheetByName(PTEM2.fMaitre);
    if (!maitre) throw new Error('Onglet « ' + PTEM2.fMaitre + ' » introuvable.');

    instantaner_(ss, maitre);
    synchroniserEntetes_(maitre);

    var vals = maitre.getDataRange().getValues();
    var ent = vals[0].map(function(v) { return String(v || '').trim(); });
    var cId = ent.indexOf('ID stable') + 1;
    var cPr = colonneParCle_(maitre, ent, 'q33_practices');
    if (cId < 1 || cPr < 1) throw new Error('Colonne « ID stable » ou « types de pratique » introuvable. Aucune donnée modifiée.');

    // libellé officiel <- code de la carte
    var libelle = {};
    PRATIQUES.forEach(function(p) { libelle[p[0]] = p[1]; });
    var ordre = champParCle_('q33_practices').options;

    var modifiees = 0, inchangees = 0;
    for (var i = 1; i < vals.length; i++) {
      var id = String(vals[i][cId - 1] || '').trim();
      var corr = PRATIQUES_CORRECTIONS[id];
      if (!corr) continue;

      var actuel = String(vals[i][cPr - 1] || '').split(/\s*;\s*/)
        .filter(function(x) { return x; });
      var apres = actuel.slice();

      corr.ajouter.forEach(function(code) {
        var lib = libelle[code];
        if (lib && apres.indexOf(lib) === -1) apres.push(lib);
      });
      corr.retirer.forEach(function(code) {
        var lib = libelle[code];
        apres = apres.filter(function(x) { return x !== lib; });
      });

      // remettre dans l'ordre officiel des options du formulaire
      apres = ordre.filter(function(o) { return apres.indexOf(o) !== -1; })
        .concat(apres.filter(function(x) { return ordre.indexOf(x) === -1; }));

      var avant = actuel.join('; '), nouveau = apres.join('; ');
      if (avant === nouveau) { inchangees++; continue; }
      maitre.getRange(i + 1, cPr).setValue(nouveau);
      journaliser_(ss, id, 'types de pratique', avant, nouveau, 'corrigerPratiques');
      console.log('fiche ' + id + ' : ' + (avant || '(vide)') + '  ->  ' + nouveau);
      modifiees++;
    }
    SpreadsheetApp.flush();
    console.log(modifiees + ' fiche(s) modifiée(s), ' + inchangees + ' déjà à jour.');
    ss.toast(modifiees + ' fiches corrigées. Relancez « Préparer l’export data.json ».', 'PTEM 2027', 10);
  } finally {
    lock.releaseLock();
  }
}

/* =====================================================================
 * CORRECTION PONCTUELLE — effectifs retirés du formulaire
 * Les questions « Infirmières en santé mentale » et « Agentes administratives »
 * sont retirées du formulaire. Trois fiches avaient déjà une valeur : plutôt
 * que de la perdre silencieusement au prochain export, on la déplace.
 *   - Sainte-Julie (infsantementale) -> ajoutée au texte « Autres professionnels »
 *   - Montérégiennes et Saint-Jean (aac) -> ajoutées aux Notes internes
 * ===================================================================== */

function corrigerEffectifsRetires() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var maitre = ss.getSheetByName(PTEM2.fMaitre);
    if (!maitre) throw new Error('Onglet « ' + PTEM2.fMaitre + ' » introuvable.');
    instantaner_(ss, maitre);

    synchroniserEntetes_(maitre);
    var vals = maitre.getDataRange().getValues();
    var ent = vals[0].map(function(v) { return String(v || '').trim(); });
    var cId = ent.indexOf('ID stable') + 1;
    // Colonnes orphelines : ces deux questions ont été retirées du formulaire,
    // on les retrouve par leur texte seul, sans dépendre d'un numéro figé.
    var cMental = colonneBrute_(ent, 'Infirmières en santé mentale');
    var cAac = colonneBrute_(ent, 'Agentes ou agents administratifs');
    var cAutres = colonneParCle_(maitre, ent, 'q68_other_professionals');
    var cNotes = ent.indexOf('Notes internes') + 1;
    if (!cAutres || !cNotes) throw new Error('Colonnes de destination introuvables. Aucune donnée modifiée.');

    var n = 0;
    for (var i = 1; i < vals.length; i++) {
      var id = String(vals[i][cId - 1] || '').trim();
      if (!id) continue;

      if (cMental) {
        var vm = String(vals[i][cMental - 1] || '').trim();
        if (vm) {
          var actuelA = String(maitre.getRange(i + 1, cAutres).getValue() || '').trim();
          var ajoutA = 'Infirmière en santé mentale : ' + vm;
          if (actuelA.indexOf(ajoutA) === -1) {
            maitre.getRange(i + 1, cAutres).setValue(actuelA ? actuelA + ' · ' + ajoutA : ajoutA);
            journaliser_(ss, id, 'autres professionnels (migration)', actuelA, ajoutA, 'corrigerEffectifsRetires');
            n++;
          }
        }
      }
      if (cAac) {
        var va = String(vals[i][cAac - 1] || '').trim();
        if (va) {
          var actuelN = String(maitre.getRange(i + 1, cNotes).getValue() || '').trim();
          var ajoutN = 'Agentes administratives (ancienne donnée, question retirée) : ' + va;
          if (actuelN.indexOf(ajoutN) === -1) {
            maitre.getRange(i + 1, cNotes).setValue(actuelN ? actuelN + '\n' + ajoutN : ajoutN);
            journaliser_(ss, id, 'notes internes (migration)', actuelN, ajoutN, 'corrigerEffectifsRetires');
            n++;
          }
        }
      }
    }
    console.log(n + ' valeur(s) migrée(s) avant retrait des questions.');
    ss.toast(n + ' valeur(s) préservée(s). Ces deux colonnes orphelines peuvent être supprimées manuellement.', 'PTEM 2027', 10);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Le champ « courriel de recrutement » (Q16) ne doit contenir qu'une adresse.
 * À l'amorçage, il a été rempli avec `personneRessource`, qui contient parfois
 * un nom plutôt qu'un courriel (« Dr Jean-Philippe Chouinard »). On vide ces
 * cas, et on conserve le nom dans les Notes internes plutôt que de le perdre.
 */
function corrigerContacts() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var maitre = ss.getSheetByName(PTEM2.fMaitre);
    if (!maitre) throw new Error('Onglet « ' + PTEM2.fMaitre + ' » introuvable.');
    instantaner_(ss, maitre);

    synchroniserEntetes_(maitre);
    var vals = maitre.getDataRange().getValues();
    var ent = vals[0].map(function(v) { return String(v || '').trim(); });
    var cId = ent.indexOf('ID stable') + 1;
    var cCourriel = colonneParCle_(maitre, ent, 'q19_recruit_email');
    var cNotes = ent.indexOf('Notes internes') + 1;
    if (!cCourriel || !cNotes) throw new Error('Colonnes introuvables. Aucune donnée modifiée.');

    var n = 0;
    for (var i = 1; i < vals.length; i++) {
      var id = String(vals[i][cId - 1] || '').trim();
      var v = String(vals[i][cCourriel - 1] || '').trim();
      if (!v || v.indexOf('@') !== -1) continue; // déjà vide ou déjà une adresse
      var actuelN = String(maitre.getRange(i + 1, cNotes).getValue() || '').trim();
      var ajoutN = 'Contact recrutement (nom, sans courriel) : ' + v;
      if (actuelN.indexOf(ajoutN) === -1) {
        maitre.getRange(i + 1, cNotes).setValue(actuelN ? actuelN + '\n' + ajoutN : ajoutN);
      }
      maitre.getRange(i + 1, cCourriel).setValue('');
      journaliser_(ss, id, 'courriel de recrutement', v, '(vidé, conservé en note)', 'corrigerContacts');
      n++;
    }
    console.log(n + ' fiche(s) nettoyée(s) : le nom est conservé dans les Notes internes, le champ courriel est vide.');
    ss.toast(n + ' contact(s) sans courriel retiré(s) du champ courriel.', 'PTEM 2027', 10);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Réécrit l'onglet « Listes » avec les valeurs actuelles de RLS, statuts,
 * publication et options de formulaire. À exécuter après tout changement
 * d'options (ex. RLS « À confirmer » -> « Autre »).
 */
function synchroniserEntetes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var maitre = ss.getSheetByName(PTEM2.fMaitre);
  if (!maitre) throw new Error('Onglet « ' + PTEM2.fMaitre + ' » introuvable.');
  instantaner_(ss, maitre);
  var r = synchroniserEntetes_(maitre);
  console.log(r.reparees + ' en-tête(s) resynchronisée(s), ' + r.creees.length + ' colonne(s) créée(s).' +
    (r.creees.length ? ' Créées : ' + r.creees.join(' | ') : ''));
  ss.toast(r.reparees + ' en-tête(s) resynchronisée(s), ' + r.creees.length + ' colonne(s) ajoutée(s).', 'PTEM 2027', 10);
}

function actualiserListes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var f = ss.getSheetByName(PTEM2.fListes);
  if (!f) throw new Error('Onglet « ' + PTEM2.fListes + ' » introuvable.');
  construireListes_(f);
  ss.toast('Listes actualisées.', 'PTEM 2027', 6);
}


/**
 * Applique les données recueillies lors de la tournée du RLS Jardins-Roussillon
 * du 10 août 2026 : met à jour 8 fiches existantes et ajoute 6 nouveaux milieux
 * découverts sur place (adresses confirmées par sources officielles ou
 * annuaires de cliniques, mais coordonnées ESTIMÉES — voir position_precision).
 *
 * N'écrase jamais un champ qui contredirait une donnée déjà sourcée sans
 * qu'on ait tranché ensemble : les pratiques ajoutent, elles ne remplacent
 * pas, sauf accord explicite (Azur reste sans PÉRI, par exemple, décision
 * d'une session précédente, non touchée ici).
 *
 * Idempotente pour la partie « mise à jour » (peut être relancée sans
 * dupliquer). Pour la partie « ajout », vérifie d'abord qu'aucune fiche du
 * même nom n'existe déjà, pour éviter les doublons si relancée après un
 * premier ajout réussi.
 */
function appliquerTourneeJardinsRoussillon() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var maitre = ss.getSheetByName(PTEM2.fMaitre);
    if (!maitre) throw new Error('Onglet « ' + PTEM2.fMaitre + ' » introuvable.');
    instantaner_(ss, maitre);
    synchroniserEntetes_(maitre);

    var vals = maitre.getDataRange().getValues();
    var ent = vals[0].map(function(v) { return String(v || '').trim(); });
    var cId = ent.indexOf('ID stable') + 1;

    function col(key) { return colonneParCle_(maitre, ent, key); }
    function ligneDe(id) {
      for (var i = 1; i < vals.length; i++) if (String(vals[i][cId - 1]).trim() === String(id)) return i + 1;
      throw new Error('Fiche id ' + id + ' introuvable dans ' + PTEM2.fMaitre + '.');
    }
    function ecrire(id, key, valeur) {
      if (valeur === undefined || valeur === null || valeur === '') return;
      maitre.getRange(ligneDe(id), col(key)).setValue(valeur);
    }
    function pratiquesActuelles(id) {
      var v = String(maitre.getRange(ligneDe(id), col('q33_practices')).getValue() || '');
      return v ? v.split(/\s*;\s*/) : [];
    }
    function unionPratiques(id, codes) {
      var ordre = champParCle_('q33_practices').options;
      var libelle = {}; PRATIQUES.forEach(function(p) { libelle[p[0]] = p[1]; });
      var actuel = pratiquesActuelles(id);
      var voulus = codes.map(function(c) { return libelle[c]; });
      var ensemble = {}; actuel.concat(voulus).forEach(function(x) { if (x) ensemble[x] = true; });
      var triees = ordre.filter(function(o) { return ensemble[o]; });
      maitre.getRange(ligneDe(id), col('q33_practices')).setValue(triees.join('; '));
    }

    var rapport = [];

    // ── 1. Mises à jour des fiches existantes ──────────────────────────

    // GMF-R Le Trait-d'Union (id 27)
    unionPratiques(27, ['gap', 'peri']);
    ecrire(27, 'q26_emrs', 'Myle — Medfar Solutions');
    ecrire(27, 'q28_offices', 'Bureau partagé');
    ecrire(27, 'q30_fees', 'Autre');
    ecrire(27, 'q31_fee_other', 'Frais fixe mensuel, avec plafond et plancher, plus frais de licence DMÉ (montants retirés de la version publique du script)');
    ecrire(27, 'qgarde_labo', 'Garde labo par infirmière');
    ecrire(27, 'qgarde_urgence', '1 fin de semaine sur 6 (quart de 6 h)');
    ecrire(27, 'qgarde_autre', 'Horaire de sans rendez-vous fixé 2 mois à l’avance, 1 à 2 quarts de 4 h par semaine. Triage pour le SRV et, si possible, pour l’accès adapté. Prélèvements urgents faits sur place pour le SRV.');
    ecrire(27, 'q69_profile', 'Radiologie sur place avec accès aux images, test d’apnée, physiothérapie, attelles plâtrées posées par le personnel infirmier, clinique spécialisée et suivi de grossesse. Pharmacie Brunet sur place.');
    rapport.push('27 — GMF-R Le Trait-d’Union : pratiques (+GAP, +PÉRI), DMÉ, bureau, frais, gardes, présentation');

    // GMF-U Jardins-Roussillon (id 28) — PÉRI et SAD confirmés conservés, MSK ajouté
    unionPratiques(28, ['msk']);
    ecrire(28, 'q30_fees', 'Aucun frais');
    ecrire(28, 'q54_family_doctors', '21');
    ecrire(28, 'q57_ipspl', '2');
    ecrire(28, 'q58_nurses', '3');
    ecrire(28, 'q65_social_workers', '2');
    ecrire(28, 'q63_dietitians', '2');
    ecrire(28, 'q64_psychologists', '1');
    ecrire(28, 'q62_pharmacists', '2');
    ecrire(28, 'q61_physios', '1');
    ecrire(28, 'q68_other_professionals', 'Inhalothérapie. Cliniques spécialisées sur place : chirurgie mineure, locomoteur.');
    rapport.push('28 — GMF-U Jardins-Roussillon : pratiques (+MSK, PÉRI/SAD conservés), frais, effectifs (comptes seulement, tableau de service non publié)');

    // GMF Mercier (id 29)
    unionPratiques(29, ['gap', 'peri']);
    ecrire(29, 'q25_gmf_level', '13');
    ecrire(29, 'q54_family_doctors', '18');
    ecrire(29, 'q58_nurses', '5');
    ecrire(29, 'q65_social_workers', '1');
    ecrire(29, 'q69_profile', 'Midi-caducée (formation continue) une fois par mois.');
    rapport.push('29 — GMF Mercier : niveau GMF 13, pratiques (+GAP, +PÉRI, CHIR conservé), effectifs, présentation');

    // GMF Jardin-du-Québec (Napierville) (id 30)
    ecrire(30, 'q57_ipspl', '1');
    ecrire(30, 'q58_nurses', '2');
    ecrire(30, 'q54_family_doctors', '3');
    ecrire(30, 'q68_other_professionals', '1 travailleuse sociale, 1 pharmacienne. Triage du SRV assuré par 2 infirmières auxiliaires.');
    ecrire(30, 'qgarde_urgence', '4 h de SRV par semaine, plus une demi-journée deux fins de semaine sur neuf (à confirmer)');
    rapport.push('30 — GMF Jardin-du-Québec (Napierville) : effectifs, note sur le SRV');

    // GMF Roger Laberge (id 32)
    unionPratiques(32, ['gap', 'msk']);
    ecrire(32, 'q25_gmf_level', '1');
    ecrire(32, 'q26_emrs', 'Medesync — TELUS');
    ecrire(32, 'q30_fees', 'Autre');
    ecrire(32, 'q31_fee_other', 'Frais fixe mensuel, temps plein (montant retiré de la version publique du script)');
    ecrire(32, 'q54_family_doctors', '6');
    ecrire(32, 'q56_specialists', '10');
    ecrire(32, 'q58_nurses', '2');
    ecrire(32, 'q59_aux_nurses', '1');
    ecrire(32, 'q62_pharmacists', '1');
    ecrire(32, 'q65_social_workers', '1');
    rapport.push('32 — GMF Roger Laberge : niveau GMF 1, DMÉ, pratiques (+GAP, +MSK, CHIR conservé), frais, effectifs (10 spécialistes confirmé)');

    // GMF Saint-Constant (de la gare) (id 33)
    unionPratiques(33, ['gap']);
    ecrire(33, 'q28_offices', 'Bureau attitré; Bureau partagé');
    ecrire(33, 'q54_family_doctors', '10');
    ecrire(33, 'q57_ipspl', '3');
    ecrire(33, 'q58_nurses', '3');
    ecrire(33, 'q30_fees', 'Autre');
    ecrire(33, 'q31_fee_other', 'Frais fixe mensuel plus taxes (montant retiré de la version publique du script)');
    ecrire(33, 'qgarde_labo', 'Garde labo par infirmière');
    ecrire(33, 'qgarde_urgence', '1 fin de semaine tous les 6 mois');
    ecrire(33, 'qgarde_autre', 'Pas de plage horaire dédiée au SRV : les rendez-vous sont plutôt intégrés chaque jour, en style relance.');
    // Version publique : le nom du responsable est conservé dans data.json,
    // mais aucune adresse courriel de recrutement n'est publiée dans le dépôt.
    ecrire(33, 'q19_recruit_email', '');
    ecrire(33, 'q25_gmf_level', '5');
    ecrire(33, 'q68_other_professionals', 'Travailleuse sociale, nutritionniste, pharmacien(ne), 2 chirurgiens, 1 interniste, 1 anesthésiologiste.');
    ecrire(33, 'q69_profile', 'Centre de prélèvement privé sur place (45 $, accès rapide), clinique d’azote, clinique de stérilet et de biopsie de l’endomètre. Peu de roulement de personnel, horaire flexible, midi-formation FMOQ avec repas. Accès rapide à la médecine interne, la dermatologie, la chirurgie et le prélèvement sanguin. Ouvert à de nouveaux projets (ex. mini-chirurgie).');
    rapport.push('33 — Saint-Constant (de la gare) : pratiques (+GAP), bureau, effectifs, frais, gardes, contact recrutement, présentation (flyer + tournée)');

    // GMF Saint-Constant (Monchamp) (id 34)
    ecrire(34, 'q56_specialists', '3');
    ecrire(34, 'q57_ipspl', '3');
    ecrire(34, 'q63_dietitians', '2');
    ecrire(34, 'q65_social_workers', '1');
    ecrire(34, 'q54_family_doctors', '1');
    ecrire(34, 'q30_fees', 'Autre');
    ecrire(34, 'q31_fee_other', 'Frais fixe mensuel (montant retiré de la version publique du script)');
    ecrire(34, 'q69_profile', 'Pharmacie Proxim à proximité.');
    rapport.push('34 — Saint-Constant (Monchamp) : effectifs, frais, présentation');

    // ── « GMF satellite » retiré du vocabulaire (confirmé le 11 août) :
    // TOUTES les fiches qui le portaient encore deviennent des GMF normaux.
    // Le type vit dans deux colonnes : celle du formulaire et la colonne
    // miroir « [carte] code de type », qui est celle que la carte lit
    // réellement. Corriger une seule des deux laisserait l'ancien type
    // s'afficher sur la carte.
    var cTypeForm = col('q10_types');
    var cTypeCarte = ent.indexOf('[carte] code de type') + 1;
    var convertis = [];
    for (var iSat = 1; iSat < vals.length; iSat++) {
      var idSat = String(vals[iSat][cId - 1] || '').trim();
      if (!idSat) continue;
      var ligneSat = iSat + 1;
      var typeForm = String(maitre.getRange(ligneSat, cTypeForm).getValue() || '').trim();
      var typeCarte = cTypeCarte > 0 ? String(maitre.getRange(ligneSat, cTypeCarte).getValue() || '').trim() : '';
      if (typeForm !== 'GMF satellite' && typeCarte !== 'GMF satellite') continue;
      if (typeForm === 'GMF satellite') maitre.getRange(ligneSat, cTypeForm).setValue('GMF');
      if (cTypeCarte > 0 && typeCarte === 'GMF satellite') maitre.getRange(ligneSat, cTypeCarte).setValue('GMF');
      var nomSat = String(maitre.getRange(ligneSat, col('q1_name')).getValue() || '');
      journaliser_(ss, idSat, 'type', 'GMF satellite', 'GMF', 'appliquerTourneeJardinsRoussillon');
      convertis.push(idSat + ' — ' + nomSat);
    }
    if (convertis.length) {
      console.log('\n« GMF satellite » -> « GMF » (' + convertis.length + ' fiche(s)) :');
      convertis.forEach(function(l) { console.log('  ' + l); });
    } else {
      console.log('\nAucune fiche « GMF satellite » restante — conversion déjà faite.');
    }

    console.log('Mises à jour appliquées :');
    rapport.forEach(function(l) { console.log('  ' + l); });

    // ── 2. Nouveaux milieux — coordonnées ESTIMÉES, à vérifier sur une carte ──

    var derniereLigne = maitre.getLastRow();
    var dernierId = 0;
    for (var i = 1; i < vals.length; i++) {
      var idN = parseInt(vals[i][cId - 1], 10);
      if (!isNaN(idN) && idN > dernierId) dernierId = idN;
    }

    var nouveaux = [
      { nom: 'GMF Carrefour Santé Le Saint-Laurent', type: 'GMF',
        adresse: '5300, boulevard Saint-Laurent, bureau 140', ville: 'Sainte-Catherine',
        lat: 45.4031, lng: -73.5847, site: 'https://www.gmfcarrefoursante.ca/',
        dme: 'Myle — Medfar Solutions',
        offices: 'Bureau attitré', fees: 'Autre', feeOther: 'Frais fixe mensuel plus taxes, DMÉ inclus, avec rabais à l\u2019arrivée (montant retiré de la version publique du script)',
        gmfLevel: '6',
        medecins: '19', ipspl: '1', infirmieres: '4', travailleusesSociales: '2', pharmaciens: '2',
        gardeUrgence: '1 fin de semaine sur 6, 3 gardes de SRV par mois, 12 plages minimum par SRV',
        gardeLabo: 'Garde labo par infirmière',
        profile: 'GMF de niveau 6. Midi-caducée deux fois par mois. Spécialistes sur place ou en accès rapide : ORL, chirurgie générale, anesthésiste (infiltrations sous écho), néphrologie. Nouveaux services non couverts par la RAMQ : injections de PRP, chirurgie esthétique mineure.' },

      { nom: 'Clinique médicale Napierville', type: 'Clinique médicale',
        adresse: '343, rue Saint-Jacques', ville: 'Napierville',
        lat: 45.1904, lng: -73.4022, dme: 'Medesync — TELUS',
        feeOther: 'Pourcentage de frais de bureau (taux retiré de la version publique du script)',
        medecins: '4', ipspl: '2',
        profile: 'Clinique de proximité. Une thérapeute en relation d’aide fait partie de l’équipe. Horaires très flexibles.' },

      { nom: 'Coopérative solidarité santé Saint-Isidore (GMF Roger Laberge)', type: 'Coopérative',
        adresse: '640, rang Saint-Régis, bureau 8', ville: 'Saint-Isidore',
        lat: 45.3000, lng: -73.6800,
        feeOther: 'Frais fixe par demi-journée (montant retiré de la version publique du script)',
        medecins: '2', specialistes: '2', ipspl: '2', infirmieres: '2',
        gardeLabo: 'Garde labo par infirmière',
        profile: 'Second site de GMF Roger Laberge. Triage avant chaque rendez-vous, suivi de laboratoire assuré par le personnel infirmier, aucune garde obligatoire, horaire au choix.' },

      { nom: 'Clinique médicale Le Soleil', type: 'Clinique médicale',
        adresse: '72, boulevard Saint-Jean-Baptiste, suite 200', ville: 'Châteauguay',
        lat: 45.3730, lng: -73.7520, feeOther: 'Sur demande',
        medecins: '3', infirmieres: '2',
        pratiques: ['pec'] },

      { nom: 'CLSC Châteauguay', type: 'CLSC',
        adresse: '95, avenue de la Verdure', ville: 'Châteauguay',
        lat: 45.3532, lng: -73.7398, feeOther: 'Aucun frais',
        pratiques: ['pec', 'sad', 'chir'],
        gardeAutre: 'Garde de SAD : une semaine sur sept. Garde labo organisée à l’interne.' },

      { nom: 'CLSC Kateri', type: 'CLSC',
        adresse: '90, boulevard Marie-Victorin', ville: 'Candiac',
        lat: 45.3670, lng: -73.4780, dme: 'Myle — Medfar Solutions',
        pratiques: ['pec', 'sad', 'chir'],
        medecins: '6', ipspl: '2', infirmieres: '6',
        gardeAutre: 'Garde de SAD : une semaine sur sept, en disponibilité (sur appel). Pas de sans rendez-vous.',
        profile: 'Hors GMF. Rémunération à l’acte : tarif horaire plus pourcentage de l’acte. DMÉ (Myle) et ordinateur fournis. Distinct de l’Hôpital Kateri Memorial (Kahnawake).' }
    ];

    var ajoutees = [];
    nouveaux.forEach(function(c) {
      var dejaLa = false;
      for (var i = 1; i < vals.length; i++) {
        if (String(vals[i][cId - 1]).trim() && String(vals[i][col('q1_name') - 1] || '').trim() === c.nom) { dejaLa = true; break; }
      }
      // vérification plus fiable : relire la colonne du nom fraîchement
      var cNomActuel = col('q1_name');
      var existant = maitre.getRange(2, cNomActuel, Math.max(maitre.getLastRow() - 1, 1), 1).getValues()
        .some(function(r) { return String(r[0] || '').trim() === c.nom; });
      if (existant) { console.log('Déjà présente, ignorée : ' + c.nom); return; }

      dernierId++;
      var r = maitre.getLastRow() + 1;
      var libellePratiques = {}; PRATIQUES.forEach(function(p) { libellePratiques[p[0]] = p[1]; });
      var ordrePratiques = champParCle_('q33_practices').options;
      var pratiquesTxt = (c.pratiques || []).map(function(code) { return libellePratiques[code]; })
        .filter(function(x, i, a) { return x && a.indexOf(x) === i; });
      pratiquesTxt = ordrePratiques.filter(function(o) { return pratiquesTxt.indexOf(o) !== -1; });

      ecrire2(r, 'id', dernierId);
      ecrire2(r, 'rls', 'Jardins-Roussillon');
      ecrire2(r, 'subregion', 'Montérégie-Ouest');
      ecrire2(r, 'region', 'Montérégie (16)');
      ecrire2(r, 'validation_status', 'À valider');
      ecrire2(r, 'update_source', 'Tournée terrain — 10 août 2026');
      ecrire2(r, 'latitude', c.lat);
      ecrire2(r, 'longitude', c.lng);
      ecrire2(r, 'position_precision', 'Approximative');
      ecrire2(r, 'publication', 'Publiée');
      ecrire2(r, 'source_notes', 'Coordonnées estimées, non géocodées précisément — à vérifier sur une carte avant diffusion large.');
      ecrire2(r, 'q1_name', c.nom);
      ecrire2(r, 'q3_rls', 'Jardins-Roussillon');
      ecrire2(r, 'q10_types', c.type);
      ecrire2(r, 'q12_website', c.site || '');
      ecrire2(r, 'q15_address', c.adresse);
      ecrire2(r, 'q16_city', c.ville);
      ecrire2(r, 'q25_gmf_level', c.gmfLevel || '');
      ecrire2(r, 'q26_emrs', c.dme || '');
      ecrire2(r, 'q28_offices', c.offices || '');
      ecrire2(r, 'q30_fees', c.fees || (c.feeOther ? 'Autre' : ''));
      ecrire2(r, 'q31_fee_other', c.feeOther || '');
      ecrire2(r, 'q33_practices', pratiquesTxt.join('; '));
      ecrire2(r, 'qgarde_labo', c.gardeLabo || '');
      ecrire2(r, 'qgarde_urgence', c.gardeUrgence || '');
      ecrire2(r, 'qgarde_autre', c.gardeAutre || '');
      ecrire2(r, 'q54_family_doctors', c.medecins || '');
      ecrire2(r, 'q56_specialists', c.specialistes || '');
      ecrire2(r, 'q57_ipspl', c.ipspl || '');
      ecrire2(r, 'q58_nurses', c.infirmieres || '');
      ecrire2(r, 'q65_social_workers', c.travailleusesSociales || '');
      ecrire2(r, 'q62_pharmacists', c.pharmaciens || '');
      ecrire2(r, 'q69_profile', c.profile || '');

      function ecrire2(ligne, key, valeur) {
        if (valeur === undefined || valeur === null || valeur === '') return;
        var colonne = (key === 'id' || key === 'rls' || key === 'subregion' || key === 'region' ||
          key === 'validation_status' || key === 'update_source' || key === 'latitude' || key === 'longitude' ||
          key === 'position_precision' || key === 'publication' || key === 'source_notes')
          ? ent.indexOf(ADMIN_COLUMNS.filter(function(a) { return a.key === key; })[0].title) + 1
          : col(key);
        maitre.getRange(ligne, colonne).setValue(valeur);
      }

      ajoutees.push(dernierId + ' — ' + c.nom + ' (' + c.ville + ')');
    });

    console.log('\nNouvelles fiches ajoutées :');
    ajoutees.forEach(function(l) { console.log('  ' + l); });
    if (!ajoutees.length) console.log('  (aucune — probablement déjà toutes ajoutées lors d’un essai précédent)');

    journaliser_(ss, '', 'tournée Jardins-Roussillon', '', ajoutees.length + ' ajout(s), 8 mise(s) à jour', 'appliquerTourneeJardinsRoussillon');
    ss.toast(ajoutees.length + ' nouvelle(s) fiche(s), 8 fiche(s) mise(s) à jour. Vérifiez les coordonnées estimées.', 'PTEM 2027', 15);
  } finally {
    lock.releaseLock();
  }
}

/* =====================================================================
 * AMORÇAGE — à exécuter une seule fois sur un classeur neuf
 * ===================================================================== */

function initialiserV2() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('Exécutez ce script depuis le classeur.');
    var props = PropertiesService.getDocumentProperties();

    if (props.getProperty(PTEM2.propAmorce) === 'true') {
      throw new Error('Ce classeur a déjà été amorcé. Pour recommencer, créez un classeur neuf. Aucune donnée n’a été modifiée.');
    }
    var maitreExistant = ss.getSheetByName(PTEM2.fMaitre);
    if (maitreExistant && maitreExistant.getLastRow() > 1) {
      throw new Error('L’onglet « ' + PTEM2.fMaitre + ' » contient déjà des données. Amorçage refusé. Aucune donnée n’a été modifiée.');
    }

    console.log('Étape 1/5 — lecture de ' + PTEM2.sourceDataJson);
    var carte = lireDataJson_();
    console.log(carte.cliniques.length + ' fiches lues (mise à jour du fichier source : ' + carte.miseAJour + ')');
    if (carte.cliniques.length < 50) {
      throw new Error('Seulement ' + carte.cliniques.length + ' fiches dans la source; amorçage refusé par précaution.');
    }

    console.log('Étape 2/5 — construction des lignes');
    var cols = colonnes_();
    var entetes = cols.map(function(c) { return c.title; });
    var lignes = carte.cliniques.map(function(c) {
      var o = versClasseur_(c);
      return cols.map(function(col) { return o[col.key] === undefined ? '' : o[col.key]; });
    });

    console.log('Étape 3/5 — écriture des onglets');
    ss.rename(PTEM2.titreClasseur);
    construireListes_(feuille_(ss, PTEM2.fListes));
    ecrireEnSecurite_(feuille_(ss, PTEM2.fMaitre), entetes, lignes, {premiereEcriture:true});
    habillerMaitre_(ss.getSheetByName(PTEM2.fMaitre), entetes);
    construireRevision_(feuille_(ss, PTEM2.fRevision));
    construireJournal_(feuille_(ss, PTEM2.fJournal));
    construireSuivi_(feuille_(ss, PTEM2.fSuivi));
    construireExport_(feuille_(ss, PTEM2.fExport));

    console.log('Étape 4/5 — contrôle d’intégrité par aller-retour');
    var ctrl = controlerAllerRetour_(carte.cliniques, lignes, entetes);
    if (!ctrl.ok) throw new Error('Contrôle d’aller-retour échoué : ' + ctrl.message);
    console.log(ctrl.message);

    console.log('Étape 5/5 — terminé');
    props.setProperty(PTEM2.propVersion, PTEM2.version);
    props.setProperty(PTEM2.propAmorce, 'true');
    journaliser_(ss, '', 'amorçage', '', carte.cliniques.length + ' fiches', 'initialiserV2');
    ss.toast(carte.cliniques.length + ' fiches importées. Rien n’a été envoyé ni publié.', 'PTEM 2027', 10);
  } finally {
    lock.releaseLock();
  }
}

function lireDataJson_() {
  var r = UrlFetchApp.fetch(PTEM2.sourceDataJson, {muteHttpExceptions:true});
  if (r.getResponseCode() !== 200) {
    throw new Error('Lecture de data.json impossible (code HTTP ' + r.getResponseCode() + ').');
  }
  var d = JSON.parse(r.getContentText());
  if (!d || !Array.isArray(d.cliniques)) throw new Error('data.json illisible : tableau « cliniques » absent.');
  return d;
}

/* =====================================================================
 * PROJECTIONS carte <-> classeur
 * ===================================================================== */

/**
 * Éclate un texte de niveau en trois valeurs.
 * Comprend les deux écritures rencontrées :
 *   ancienne — « Niveau 17 », « Mission GMF : Niveau 12 · Mission accès réseau : Niveau 4 », « Niveau 3 (GMF-R) »
 *   nouvelle — « GMF 17 », « GMF 12 · Accès-réseau 4 », « Accès-réseau 3 », « GMF-U à confirmer »
 */
function eclaterNiveaux_(texte) {
  var s = String(texte || '').trim(), r = {gmf:'', acc:'', gmfu:''}, m;
  if (!s) return r;

  // --- écriture nouvelle : sigle suivi de la valeur, segments séparés par « · »
  s.split(/\s*[·;]\s*/).forEach(function(seg) {
    var g = seg.match(/^GMF-U\s+(.+)$/i);            if (g) { r.gmfu = g[1].trim(); return; }
    var a = seg.match(/^Acc[eè]s[-\s]r[eé]seau\s+(.+)$/i); if (a) { r.acc = a[1].trim(); return; }
    var f = seg.match(/^GMF\s+(\d+)$/i);              if (f) { r.gmf = f[1]; return; }
  });
  if (r.gmf || r.acc || r.gmfu) {
    if (/^à confirmer$/i.test(r.gmfu)) r.gmfu = 'À confirmer';
    return r;
  }

  // --- écriture ancienne
  m = s.match(/Mission GMF\s*:\s*Niveau\s*(\d+)/i);           if (m) r.gmf = m[1];
  m = s.match(/acc[eè]s\s+r[eé]seau\s*:?\s*Niveau\s*(\d+)/i); if (m) r.acc = m[1];
  m = s.match(/Niveau GMF-U\s*(\d+)/i);                        if (m) r.gmfu = m[1];
  if (!r.gmf) { m = s.match(/^Niveau\s*(\d+)/i); if (m) r.gmf = m[1]; }
  if (/GMF-U/i.test(s) && !/\d/.test(s)) r.gmfu = 'À confirmer';
  m = s.match(/Niveau\s*(\d+)\s*\(GMF-R\)/i);                if (m) { r.gmf = ''; r.acc = m[1]; }
  return r;
}

function libelleNiveaux_(n) {
  // Un niveau non numérique (« À confirmer ») se lit en minuscule après le sigle.
  var v = function(x) {
    x = String(x || '').trim();
    return /^\d+$/.test(x) ? x : x.charAt(0).toLowerCase() + x.slice(1);
  };
  var p = [];
  if (v(n.gmf))  p.push('GMF ' + v(n.gmf));
  if (v(n.acc))  p.push('Accès-réseau ' + v(n.acc));
  if (v(n.gmfu)) p.push('GMF-U ' + v(n.gmfu));
  return p.join(' · ');
}

function versClasseur_(c) {
  var typeCode = TYPE_NORM[c.type] || c.type || '';
  var nv = eclaterNiveaux_(c.niveau);
  var fraisForm = chercher_(FRAIS, c.frais, '');
  var o = {
    id: String(c.id),
    rls: c.rls || 'À confirmer',
    subregion: chercher_(REGION, c.region, ''),
    region: 'Montérégie (16)',
    validation_status: 'À valider',
    update_source: 'Amorçage data.json',
    latitude: (c.lat === null || c.lat === undefined) ? '' : c.lat,
    longitude: (c.lng === null || c.lng === undefined) ? '' : c.lng,
    position_precision: c.posApprox ? 'Approximative' : 'Vérifiée',
    source_notes: '',
    carte_type: typeCode,
    carte_notes: c.notes || '',
    q2_alias: c.alias || '',
    publication: 'Publiée',
    q1_name: c.nom || '',
    q3_rls: c.rls || 'À confirmer',
    q10_types: chercher_(TYPE, typeCode, typeCode),
    q11_type_other: TYPE_AUTRE[c.type] || '',
    q12_website: c.site || '',
    q15_address: c.adresse || '',
    q16_city: c.ville || '',
    q19_recruit_email: c.personneRessource || '',
    q22_doctors_sought: c.medecinsRecherches || '',
    q69_profile: c.presentation || '',
    q25_gmf_level: nv.gmf,
    q25_access_level: nv.acc,
    q25_gmfu_level: nv.gmfu,
    q26_emrs: c.dme ? chercher_(DME, c.dme, c.dme) : '',
    q28_offices: chercher_(BUREAU, c.bureau, ''),
    q30_fees: fraisForm,
    q31_fee_other: (fraisForm === 'Autre') ? c.frais : '',
    q33_practices: (c.pratiques || []).map(function(p) { return chercher_(PRATIQUES, p, p); }).join('; '),
    q38_open_house: c.porteOuverte || '',
    qgarde_labo: c.gardeLabo || '',
    qgarde_urgence: c.gardeUrgence || '',
    qgarde_autre: c.gardeAutre || '',
    q51_hours_notes: c.infos || ''
  };
  for (var i = 0; i < JOURS.length; i++) o[CLES_JOURS[i]] = (c.horaire || {})[JOURS[i]] || '';
  PERSONNEL.forEach(function(p) {
    var v = (c.personnel || {})[p[0]];
    o[p[1]] = (v === null || v === undefined) ? '' : String(v);
  });
  return o;
}

/**
 * gabaritPersonnel : liste des catégories de personnel à émettre pour cette
 * fiche. Sans elle, l'export inventerait des catégories vides que la carte
 * n'affichait pas. Fournie par l'ancien data.json au premier export, puis
 * stockée dans la colonne « Notes internes » n'est PAS souhaitable : on émet
 * simplement toute catégorie non vide, plus celles déjà connues.
 */
/**
 * Convertit une valeur de cellule en texte. Google Sheets transforme
 * « 16 juillet 2026 » en objet Date : sans cette conversion, data.json
 * recevrait « Thu Jul 16 2026 00:00:00 GMT-0400 (heure d'été…) ».
 */
var MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet',
               'août','septembre','octobre','novembre','décembre'];
function txt_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return v.getDate() + ' ' + MOIS_FR[v.getMonth()] + ' ' + v.getFullYear();
  }
  return String(v);
}

function versCarte_(r, gabaritPersonnel) {
  var nv = {
    gmf: String(r.q25_gmf_level || '').trim(),
    accesReseau: String(r.q25_access_level || '').trim(),
    gmfu: String(r.q25_gmfu_level || '').trim()
  };
  var horaire = {}, vide = true;
  for (var i = 0; i < JOURS.length; i++) {
    var v = txt_(r[CLES_JOURS[i]]);
    if (v) { horaire[JOURS[i]] = v; vide = false; }
  }
  var personnel = {};
  PERSONNEL.forEach(function(p) {
    var v = txt_(r[p[1]]);
    var attendu = gabaritPersonnel && gabaritPersonnel.indexOf(p[0]) !== -1;
    if (v !== '' || attendu) personnel[p[0]] = v;
  });
  var prat = String(r.q33_practices || '').split(/\s*;\s*/).filter(function(x) { return x; })
    .map(function(p) { return chercher_(inverser_(PRATIQUES), p, p); });
  var o = {
    id: Number(r.id),
    nom: txt_(r.q1_name),
    alias: txt_(r.q2_alias),
    visible: String(r.publication || '').trim() !== 'Masquée',
    type: typeCarte_(r.carte_type, r.q10_types, r.q11_type_other),
    adresse: txt_(r.q15_address),
    ville: txt_(r.q16_city),
    lat: (r.latitude === '' || r.latitude === null) ? null : Number(r.latitude),
    lng: (r.longitude === '' || r.longitude === null) ? null : Number(r.longitude),
    site: txt_(r.q12_website),
    // Courriel de recrutement : publié volontairement sur le site (décision du 2 sept. 2026).
    personneRessource: txt_(r.q19_recruit_email),
    dme: r.q26_emrs ? chercher_(inverser_(DME), r.q26_emrs, String(r.q26_emrs)) : '',
    horaire: vide ? {} : horaire,
    personnel: personnel,
    notes: txt_(r.carte_notes),
    rls: txt_(r.q3_rls),
    posApprox: r.position_precision === 'Approximative',
    bureau: reduireCases_(r.q28_offices, BUREAU_RETOUR),
    frais: (String(r.q30_fees || '').trim() === 'Autre' && String(r.q31_fee_other || '').trim())
      ? String(r.q31_fee_other).trim() : reduireCases_(r.q30_fees, FRAIS_RETOUR),
    pratiques: prat,
    niveaux: nv,
    niveau: libelleNiveaux_({gmf:nv.gmf, acc:nv.accesReseau, gmfu:nv.gmfu}),
    porteOuverte: txt_(r.q38_open_house),
    region: chercher_(inverser_(REGION), r.subregion, ''),
    infos: txt_(r.q51_hours_notes),
    gardeLabo: txt_(r.qgarde_labo),
    gardeUrgence: txt_(r.qgarde_urgence),
    gardeAutre: txt_(r.qgarde_autre),
    presentation: txt_(r.q69_profile)
  };
  if (r.q22_doctors_sought) o.medecinsRecherches = String(r.q22_doctors_sought);
  return o;
}

/**
 * Conserve les champs présents dans le JSON publié mais absents du classeur
 * (audit 2 sept. 2026). N'écrase jamais une valeur déjà fournie par le formulaire.
 */
function enrichirDepuisPrecedent_(fiche, precedente, ligneClasseur) {
  if (!precedente) return fiche;
  var CHAMPS_A_PRESERVER = [
    'responsableNom', 'categorie', 'recrutementActif', 'statutRecrutement',
    'horaireSource', 'sourceRepertoire', 'raisonMasquage', 'publication',
    'validation', 'niveaux'
  ];
  CHAMPS_A_PRESERVER.forEach(function(k) {
    if (fiche[k] === undefined || fiche[k] === null || fiche[k] === '') {
      if (precedente[k] !== undefined) fiche[k] = precedente[k];
    }
  });
  // Déduire recrutementActif depuis la réponse formulaire si elle est explicite.
  var recrute = String(ligneClasseur && ligneClasseur.q8_recruitment || '').trim();
  if (recrute === 'Non, le milieu ne recrute pas actuellement' ||
      recrute === 'Non, l’établissement ne recrute pas actuellement') {
    fiche.recrutementActif = false;
  } else if (recrute.indexOf('Oui') === 0) {
    fiche.recrutementActif = true;
  }
  // Ne jamais écraser un courriel déjà saisi dans le classeur par une valeur vide.
  if (!String(fiche.personneRessource || '').trim() && String(precedente.personneRessource || '').trim()) {
    fiche.personneRessource = precedente.personneRessource;
  }
  return fiche;
}

/**
 * Vérifie que la projection classeur -> carte restitue bien la source.
 * Deux nettoyages sont VOULUS et donc tolérés, mais comptés et rapportés :
 *   - type   : « Clinique » devient « Clinique médicale » (doublon de l'app)
 *   - bureau : « dédié et partagé » devient « dédié ou partagé »
 * Tout autre écart est une perte de donnée et bloque l'amorçage.
 */
function controlerAllerRetour_(cliniquesSource, lignes, entetes) {
  // 'telephone' n'est plus publié depuis le 10 août 2026 (retiré du formulaire
  // et de la fiche) : il ne fait plus partie des champs critiques.
  var CRITIQUES = ['nom','adresse','ville','rls','region','type','site',
                   'horaire','pratiques','infos','bureau','frais','dme','lat','lng'];
  var problemes = [], nettoyages = [];
  for (var i = 0; i < lignes.length; i++) {
    var r = objetDepuisLigne_(entetes, lignes[i], colonnes_());
    var src = cliniquesSource[i];
    var refait = versCarte_(r, Object.keys(src.personnel || {}));
    CRITIQUES.forEach(function(k) {
      if (JSON.stringify(refait[k]) === JSON.stringify(src[k])) return;
      var voulu =
        (k === 'type'   && refait[k] === (TYPE_NORM[src.type] || src.type)) ||
        (k === 'bureau' && BUREAU_RETOUR[chercher_(BUREAU, src.bureau, '')] === refait[k]);
      if (voulu) nettoyages.push('fiche ' + src.id + ' ' + k + ' : ' +
        JSON.stringify(src[k]) + ' → ' + JSON.stringify(refait[k]));
      else problemes.push('fiche ' + src.id + ' champ ' + k + ' : ' +
        JSON.stringify(src[k]) + ' → ' + JSON.stringify(refait[k]));
    });
    // Les trois niveaux doivent restituer exactement l'éclatement de la source.
    var attendu = eclaterNiveaux_(src.niveau);
    if (refait.niveaux.gmf !== attendu.gmf || refait.niveaux.accesReseau !== attendu.acc ||
        refait.niveaux.gmfu !== attendu.gmfu) {
      problemes.push('fiche ' + src.id + ' : éclatement des niveaux incorrect');
    } else if (refait.niveau !== String(src.niveau || '')) {
      nettoyages.push('fiche ' + src.id + ' niveau : ' + JSON.stringify(src.niveau) +
        ' → ' + JSON.stringify(refait.niveau));
    }
    // Le bloc personnel doit contenir exactement les mêmes catégories.
    var a = Object.keys(src.personnel || {}).sort().join(','),
        b = Object.keys(refait.personnel || {}).sort().join(',');
    if (a !== b) problemes.push('fiche ' + src.id + ' : catégories de personnel différentes');
  }
  var msg = lignes.length + ' fiches vérifiées. ';
  msg += problemes.length ? 'PERTES : ' + problemes.slice(0, 6).join(' · ')
                          : 'aucune perte de donnée. ';
  msg += nettoyages.length ? nettoyages.length + ' nettoyage(s) volontaire(s) : ' +
    nettoyages.join(' · ') : 'aucun nettoyage nécessaire.';
  return {ok: problemes.length === 0, message: msg, nettoyages: nettoyages.length};
}

/* =====================================================================
 * EXPORT — préparation seulement, aucune publication
 * ===================================================================== */

function preparerExport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var res = genererDataJson_(ss);

  // Le JSON dépasse la limite de 50 000 caractères par cellule de Google Sheets.
  // On l'écrit donc comme fichier dans le Drive (privé, non partagé) et on ne
  // met dans la feuille que le rapport et le lien.
  var fichier = ecrireFichierExport_(res.json);

  var f = feuille_(ss, PTEM2.fExport);
  construireExport_(f);
  f.getRange('A5').setValue(res.rapport);
  f.getRange('B5').setFormula('=HYPERLINK("' + fichier.getUrl() + '";"' + fichier.getName() + '")');
  f.getRange('B6').setValue('Fichier créé dans votre Drive, dossier « ' + PTEM2.dossierExports +
    ' ». Il n’est partagé avec personne. Téléchargez-le, puis déposez-le dans le dépôt GitHub sous le nom data.json.');
  f.getRange('B6').setWrap(true);

  journaliser_(ss, '', 'export préparé', '', res.fiches.length + ' fiches', fichier.getName());
  afficherJson_(res.json, res.rapport, fichier.getUrl());
  console.log(res.rapport);
  console.log('Fichier : ' + fichier.getUrl());
}

/** Crée le fichier d'export dans le Drive et purge les plus anciens. */
function ecrireFichierExport_(json) {
  var dossiers = DriveApp.getFoldersByName(PTEM2.dossierExports);
  var dossier = dossiers.hasNext() ? dossiers.next() : DriveApp.createFolder(PTEM2.dossierExports);
  var horo = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Toronto', 'yyyyMMdd-HHmmss');
  var fichier = dossier.createFile('data-' + horo + '.json', json, 'application/json');

  // Ne garder que les N exports les plus récents.
  var liste = [], it = dossier.getFiles();
  while (it.hasNext()) {
    var x = it.next();
    if (/^data-\d{8}-\d{6}\.json$/.test(x.getName())) liste.push(x);
  }
  liste.sort(function(a, b) { return b.getDateCreated() - a.getDateCreated(); });
  for (var i = PTEM2.exportsConserves; i < liste.length; i++) {
    try { liste[i].setTrashed(true); } catch (e) {}
  }
  return fichier;
}

/** Fenêtre avec le JSON complet et un bouton de copie, en solution de rechange. */
function afficherJson_(json, rapport, url) {
  var html = '<style>body{font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:14px;color:#1e2430}'
    + 'pre{background:#f3f4f7;border:1px solid #e3e6ec;border-radius:6px;padding:9px;font-size:11.5px;white-space:pre-wrap;margin:0 0 12px}'
    + 'textarea{width:100%;height:170px;font-family:ui-monospace,Menlo,monospace;font-size:10px;border:1px solid #d3d7de;border-radius:6px;padding:8px}'
    + 'button{background:#0080D7;color:#fff;border:0;border-radius:6px;padding:9px 15px;font-weight:700;cursor:pointer;font-size:13px}'
    + 'a{color:#0080D7} .ok{color:#1b7f3b;font-weight:700;margin-left:10px}</style>'
    + '<pre>' + json.replace(/&/g,'&amp;').replace(/</g,'&lt;') .slice(0,0) + rapport.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</pre>'
    + '<p><b>Fichier prêt :</b> <a href="' + url + '" target="_blank">ouvrir dans le Drive</a> — '
    + 'téléchargez-le, renommez-le <code>data.json</code>, déposez-le dans le dépôt.</p>'
    + '<p>Ou copiez le contenu ci-dessous :</p>'
    + '<textarea id="j" readonly></textarea><p><button onclick="cp()">Copier le data.json</button>'
    + '<span id="m" class="ok"></span></p>'
    + '<script>var J=' + JSON.stringify(json) + ';document.getElementById("j").value=J;'
    + 'function cp(){var t=document.getElementById("j");t.select();document.execCommand("copy");'
    + 'document.getElementById("m").textContent="Copié ("+J.length+" caractères)";}<\/script>';
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(560).setHeight(470), 'Export data.json');
}

function genererDataJson_(ss) {
  var maitre = ss.getSheetByName(PTEM2.fMaitre);
  if (!maitre) throw new Error('Onglet « ' + PTEM2.fMaitre + ' » introuvable.');

  // Répare silencieusement les en-têtes avant de lire quoi que ce soit : le
  // formulaire a pu être modifié depuis l'amorçage, ce qui décale les numéros
  // sans que les en-têtes du classeur ne suivent d'elles-mêmes.
  var reparation = synchroniserEntetes_(maitre);
  if (reparation.reparees) console.log(reparation.reparees + ' en-tête(s) resynchronisée(s) avec le formulaire actuel.');

  var vals = maitre.getDataRange().getValues();
  var entetes = vals[0].map(function(v) { return String(v || '').trim(); });
  var cols = colonnes_();
  var manquantes = cols.filter(function(c) { return entetes.indexOf(c.title) === -1; });
  if (manquantes.length) {
    throw new Error('Colonnes absentes de « ' + PTEM2.fMaitre + ' » : ' +
      manquantes.slice(0, 5).map(function(c) { return c.title; }).join(', '));
  }

  var precedent = lireDataJson_();
  var gabarits = {};
  var precedenteParId = {};
  precedent.cliniques.forEach(function(c) {
    gabarits[String(c.id)] = Object.keys(c.personnel || {});
    precedenteParId[String(c.id)] = c;
  });

  var fiches = [], erreurs = [], avis = [], exclues = [], masquees = [];
  var ids = {};
  for (var i = 1; i < vals.length; i++) {
    var vide = vals[i].every(function(v) { return v === '' || v === null; });
    if (vide) continue;
    var r = objetDepuisLigne_(entetes, vals[i], cols);
    var id = String(r.id || '').trim();
    if (!id) { erreurs.push('ligne ' + (i + 1) + ' : ID stable vide'); continue; }
    if (!/^\d+$/.test(id)) { erreurs.push('ligne ' + (i + 1) + ' : ID « ' + id + ' » non numérique'); continue; }
    if (ids[id]) { erreurs.push('ID ' + id + ' en double'); continue; }
    ids[id] = true;
    if (!txt_(r.q1_name).trim()) { erreurs.push('fiche ' + id + ' : nom vide'); continue; }

    // PUBLICATION — pilotée par la colonne « Publication », que tu contrôles.
    // « Non publiée » : la fiche n'entre PAS dans data.json. C'est le seul
    //   traitement qui respecte un refus, puisque data.json est public.
    // « Masquée » : la fiche entre dans data.json avec visible = false;
    //   l'application ne l'affiche pas, mais elle revient d'un seul mot.
    var pub = String(r.publication || '').trim() || 'Publiée';
    if (PUBLICATION.indexOf(pub) === -1) {
      erreurs.push('fiche ' + id + ' : valeur de Publication inconnue « ' + pub + ' »'); continue;
    }
    if (pub === 'Non publiée') { exclues.push(String(id)); continue; }
    if (pub === 'Masquée') masquees.push(id + ' (' + r.q1_name + ')');

    // Les réponses au formulaire ne changent jamais la publication d'elles-mêmes :
    // elles te le signalent, tu décides.
    if (String(r.q9_map || '').trim() === 'Non' && pub !== 'Non publiée') {
      avis.push('fiche ' + id + ' : la clinique a REFUSÉ de paraître sur la carte — mettez Publication à « Non publiée »');
    }
    if (String(r.q8_recruitment || '').trim() === 'Non, le milieu ne recrute pas actuellement' && pub === 'Publiée') {
      avis.push('fiche ' + id + ' : le milieu déclare ne pas recruter — mettez Publication à « Masquée »');
    }
    if (String(r.q9_map || '').trim() === 'Je souhaite d’abord en discuter') {
      avis.push('fiche ' + id + ' : la clinique veut d’abord en discuter avant publication');
    }
    if (String(r.latitude || '') === '' || String(r.longitude || '') === '') {
      avis.push('fiche ' + id + ' : latitude ou longitude absente — aucun marqueur, à géocoder à la main');
    }
    fiches.push(enrichirDepuisPrecedent_(versCarte_(r, gabarits[id]), precedenteParId[id], r));
  }
  fiches.sort(function(a, b) { return a.id - b.id; });

  // --- garde-fous ---
  if (erreurs.length) {
    throw new Error('Export refusé — ' + erreurs.length + ' problème(s) : ' + erreurs.slice(0, 6).join(' · '));
  }
  if (!fiches.length) throw new Error('Export refusé : aucune fiche valide.');
  var avant = precedent.cliniques.length, apres = fiches.length;
  if (apres < avant * (1 - PTEM2.seuilBaisse)) {
    throw new Error('Export refusé : le nombre de fiches passerait de ' + avant + ' à ' + apres +
      ', soit une baisse de plus de ' + Math.round(PTEM2.seuilBaisse * 100) + ' %. ' +
      'Vérifiez « ' + PTEM2.fMaitre + ' » avant de réessayer.');
  }
  var idsAvant = precedent.cliniques.map(function(c) { return String(c.id); });
  var disparus = idsAvant.filter(function(x) { return !ids[x] && exclues.indexOf(x) === -1; });
  if (disparus.length) {
    throw new Error('Export refusé : fiche(s) présente(s) en ligne mais absente(s) du classeur : ' +
      disparus.join(', ') + '. Restaurez-les ou retirez-les volontairement du data.json publié.');
  }

  var sortie = {
    miseAJour: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Toronto', 'yyyy-MM-dd'),
    annonce: precedent.annonce ? precedent.annonce : {titre:'', texte:'', lien:'', lienCarte:'', dateFin:''},
    hopitaux: Array.isArray(precedent.hopitaux) ? precedent.hopitaux : [],
    cliniques: fiches
  };
  if (!sortie.hopitaux.length) {
    throw new Error('Export refusé : le data.json de référence ne contient pas le tableau hopitaux. '
      + 'Corrigez la référence avant de préparer un export.');
  }
  var json = JSON.stringify(sortie, null, 2);
  var court = fiches.length + ' fiches prêtes. Rien n’a été publié.';
  var rapport = [
    'Export préparé le ' + sortie.miseAJour,
    'Fiches : ' + fiches.length + ' (en ligne actuellement : ' + precedent.cliniques.length + ')',
    'Hôpitaux conservés : ' + sortie.hopitaux.length,
    'Caractères : ' + json.length,
    'Tous les garde-fous sont passés.',
    exclues.length ? 'ABSENTES de data.json (Non publiée) : ' + exclues.join(', ') : 'Aucune fiche retirée.',
    masquees.length ? 'MASQUÉES sur la carte (visible = false) : ' + masquees.join(', ') : 'Aucune fiche masquée.',
    avis.length ? 'À VÉRIFIER :\n  - ' + avis.join('\n  - ') : 'Aucun avertissement.',
    'AUCUNE PUBLICATION : copiez le contenu de A5 dans data.json du dépôt vous-même.'
  ].join('\n');
  return {json:json, rapport:rapport, court:court, fiches:fiches};
}

/* =====================================================================
 * ÉCRITURE SÉCURISÉE — instantané, puis écrire avant d'effacer
 * ===================================================================== */

function creerInstantane() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var nom = instantaner_(ss, ss.getSheetByName(PTEM2.fMaitre));
  ss.toast('Instantané créé : ' + nom, 'PTEM 2027', 8);
}

function instantaner_(ss, feuilleSource) {
  if (!feuilleSource) return '';
  var horo = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Toronto', 'yyyyMMdd-HHmmss');
  var base = (PTEM2.fInstantanes + ' ' + horo).slice(0, 95);
  var nom = base, n = 2;
  while (ss.getSheetByName(nom)) { nom = (base.slice(0, 91) + ' (' + n + ')').slice(0, 99); n++; }
  var copie = feuilleSource.copyTo(ss);
  copie.setName(nom);
  try { copie.setTabColor('#A6A6A6'); copie.hideSheet(); } catch (e) {}
  purgerInstantanes_(ss);
  return nom;
}

function purgerInstantanes_(ss) {
  var limite = new Date().getTime() - PTEM2.joursInstantanes * 86400000;
  ss.getSheets().forEach(function(f) {
    var m = f.getName().match(/^Instantané (\d{8})-(\d{6})/);
    if (!m) return;
    var d = new Date(m[1].slice(0,4) + '-' + m[1].slice(4,6) + '-' + m[1].slice(6,8) + 'T00:00:00');
    if (d.getTime() < limite) { try { ss.deleteSheet(f); } catch (e) {} }
  });
}

/**
 * Écrit des lignes dans une feuille SANS jamais la vider avant d'avoir
 * confirmé que les nouvelles valeurs sont en place. Une interruption ne peut
 * plus laisser la feuille vide.
 */
function ecrireEnSecurite_(feuilleCible, entetes, lignes, options) {
  options = options || {};
  var ss = feuilleCible.getParent();
  if (!lignes.length) throw new Error('Écriture refusée : aucune ligne à écrire.');
  if (lignes.some(function(l) { return l.length !== entetes.length; })) {
    throw new Error('Écriture refusée : une ligne n’a pas ' + entetes.length + ' colonnes.');
  }
  if (!options.premiereEcriture) instantaner_(ss, feuilleCible);

  var temp = ss.insertSheet('__tmp_' + new Date().getTime());
  try {
    temp.getRange(1, 1, 1, entetes.length).setValues([entetes]);
    temp.getRange(2, 1, lignes.length, entetes.length).setValues(lignes);
    SpreadsheetApp.flush();
    if (temp.getLastRow() !== lignes.length + 1) {
      throw new Error('Écriture temporaire incomplète : ' + (temp.getLastRow() - 1) + ' lignes sur ' + lignes.length + '.');
    }
    // Le contenu est confirmé : on peut remplacer.
    if (feuilleCible.getFilter()) feuilleCible.getFilter().remove();
    if (feuilleCible.getMaxRows() < lignes.length + 1) {
      feuilleCible.insertRowsAfter(feuilleCible.getMaxRows(), lignes.length + 1 - feuilleCible.getMaxRows());
    }
    if (feuilleCible.getMaxColumns() < entetes.length) {
      feuilleCible.insertColumnsAfter(feuilleCible.getMaxColumns(), entetes.length - feuilleCible.getMaxColumns());
    }
    var aEffacer = Math.max(feuilleCible.getLastRow() - 1, lignes.length);
    if (aEffacer > 0) feuilleCible.getRange(2, 1, aEffacer, entetes.length).clearContent();
    feuilleCible.getRange(1, 1, 1, entetes.length).setValues([entetes]);
    feuilleCible.getRange(2, 1, lignes.length, entetes.length).setValues(lignes);
    SpreadsheetApp.flush();
    if (feuilleCible.getLastRow() !== lignes.length + 1) {
      throw new Error('Écriture finale incomplète. L’onglet temporaire ' + temp.getName() + ' est conservé pour récupération.');
    }
  } finally {
    try { if (feuilleCible.getLastRow() === lignes.length + 1) ss.deleteSheet(temp); } catch (e) {}
  }
}

/* =====================================================================
 * ONGLETS
 * ===================================================================== */

function feuille_(ss, nom) { return ss.getSheetByName(nom) || ss.insertSheet(nom); }

function habillerMaitre_(f, entetes) {
  f.setFrozenRows(1);
  f.setFrozenColumns(2);
  f.setHiddenGridlines(true);
  f.setRowHeight(1, 58);
  var nAdmin = ADMIN_COLUMNS.length, nCarte = CARTE_COLUMNS.length;
  var couleurs = entetes.map(function(_, i) {
    if (i < nAdmin) return '#0B3954';
    if (i < nAdmin + nCarte) return '#5F5E5A';
    var q = i - nAdmin - nCarte + 1;
    if (q <= 6) return '#087E8B';   // identification (3 questions retirées)
    if (q <= 14) return '#2E75B6';  // coordonnées (1 question retirée)
    if (q <= 29) return '#C47F00';  // recrutement et organisation
    if (q <= 32) return '#A61C00';  // gardes
    if (q <= 40) return '#2E75B6';  // heures d'ouverture
    if (q <= 53) return '#38761D';  // équipe (2 questions retirées)
    return '#674EA7';
  });
  var tete = f.getRange(1, 1, 1, entetes.length);
  tete.setFontWeight('bold').setFontColor('#FFFFFF').setWrap(true).setVerticalAlignment('middle');
  tete.setBackgrounds([couleurs]);
  f.setColumnWidth(1, 80);
  f.setColumnWidths(2, entetes.length - 1, 170);
  f.getRange(2, 1, Math.max(f.getLastRow() - 1, 1), entetes.length).setVerticalAlignment('top').setWrap(true);
  f.getRange(1, 1, f.getLastRow(), entetes.length).createFilter();
  validationsMaitre_(f, entetes);
  formatStatuts_(f, entetes);
}

function validationsMaitre_(f, entetes) {
  var ss = f.getParent();
  var listes = ss.getSheetByName(PTEM2.fListes);
  var maxL = Math.max(f.getMaxRows() - 1, 1);
  var colStatut = entetes.indexOf('Statut de validation') + 1;
  if (colStatut > 0) f.getRange(2, colStatut, maxL, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(listes.getRange(2, 1, STATUTS.length, 1), true)
      .setAllowInvalid(false).build());
  var colPub = entetes.indexOf('Publication') + 1;
  if (colPub > 0) f.getRange(2, colPub, maxL, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(listes.getRange(2, 2, PUBLICATION.length, 1), true)
      .setAllowInvalid(false).build());
  [entetes.indexOf('RLS') + 1, entetes.indexOf(champParCle_('q3_rls').title) + 1].forEach(function(col) {
    if (col > 0) f.getRange(2, col, maxL, 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInRange(listes.getRange(2, 3, RLS.length, 1), true)
        .setAllowInvalid(false).build());
  });
  ['Date d’envoi','Date de réponse','Dernière vérification','Dernier horodatage de réponse'].forEach(function(t) {
    var c = entetes.indexOf(t) + 1;
    if (c > 0) f.getRange(2, c, maxL, 1).setNumberFormat('yyyy-mm-dd');
  });
}

function formatStatuts_(f, entetes) {
  var col = entetes.indexOf('Statut de validation') + 1;
  if (col < 1) return;
  var plage = f.getRange(2, col, Math.max(f.getMaxRows() - 1, 1), 1);
  var fonds = ['#FFF2CC','#D9EAF7','#D9EAD3','#B6D7A8','#F4CCCC','#E6E6E6'];
  f.setConditionalFormatRules(STATUTS.map(function(s, i) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(s).setBackground(fonds[i]).setRanges([plage]).build();
  }));
}

function construireListes_(f) {
  var cols = [
    ['Statuts de validation'].concat(STATUTS),
    ['Publication'].concat(PUBLICATION),
    ['RLS'].concat(RLS),
    ['Sous-régions','Montérégie-Est','Montérégie-Centre','Montérégie-Ouest'],
    ['Types de milieu'].concat(champParCle_('q10_types').options),
    ['DMÉ'].concat(champParCle_('q26_emrs').options),
    ['Types de bureau'].concat(champParCle_('q28_offices').options),
    ['Modalités des frais'].concat(champParCle_('q30_fees').options),
    ['Types de pratique'].concat(champParCle_('q33_practices').options)
  ];
  var h = Math.max.apply(null, cols.map(function(c) { return c.length; }));
  var m = [];
  for (var i = 0; i < h; i++) m.push(cols.map(function(c) { return c[i] || ''; }));
  f.clear();
  f.getRange(1, 1, m.length, cols.length).setValues(m);
  f.setFrozenRows(1);
  f.setHiddenGridlines(true);
  f.getRange(1, 1, 1, cols.length).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#2E75B6').setWrap(true);
  f.setColumnWidths(1, cols.length, 210);
}

function construireRevision_(f) {
  f.clear();
  f.getRange('A1:H1').merge()
    .setValue('MODIFICATIONS PROPOSÉES — rien n’est reporté dans « Cliniques maître » sans approbation')
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#C47F00').setHorizontalAlignment('center');
  f.getRange('A3:H3').setValues([['Horodatage','ID','Clinique','Champ','Valeur actuelle','Valeur proposée','Approuver','Source']]);
  f.getRange('A3:H3').setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#C47F00');
  f.setFrozenRows(3);
  f.setHiddenGridlines(true);
  f.setColumnWidths(1, 8, 170);
  f.getRange(4, 7, Math.max(f.getMaxRows() - 3, 1), 1).insertCheckboxes();
}

function construireJournal_(f) {
  f.clear();
  f.getRange('A1:G1').merge().setValue('JOURNAL — ajout seul, ne jamais modifier ni effacer')
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#0B3954').setHorizontalAlignment('center');
  f.getRange('A3:G3').setValues([['Horodatage','ID','Champ','Avant','Après','Source','Utilisateur']]);
  f.getRange('A3:G3').setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#0B3954');
  f.setFrozenRows(3);
  f.setHiddenGridlines(true);
  f.setColumnWidths(1, 7, 170);
}

function journaliser_(ss, id, champ, avant, apres, source) {
  var f = ss.getSheetByName(PTEM2.fJournal);
  if (!f) return;
  var utilisateur = '';
  try { utilisateur = Session.getActiveUser().getEmail() || ''; } catch (e) {}
  f.appendRow([new Date(), id, champ, avant, apres, source, utilisateur]);
}

function construireSuivi_(f) {
  f.clear();
  f.getRange('A1:H1').merge().setValue('SUIVI DE LA COLLECTE PAR RLS')
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#0B3954').setHorizontalAlignment('center');
  f.getRange('A3:H3').setValues([['RLS','Total fiches','À envoyer','Envoyées','Réponses reçues','Validées','À corriger','Progression']]);
  f.getRange('A3:H3').setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#2E75B6');
  var liste = RLS.filter(function(v) { return v !== 'À confirmer'; });
  f.getRange(4, 1, liste.length, 1).setValues(liste.map(function(v) { return [v]; }));
  f.getRange(4 + liste.length, 1).setValue('TOTAL').setFontWeight('bold');
  f.setFrozenRows(3);
  f.setHiddenGridlines(true);
  f.setColumnWidth(1, 230);
  f.setColumnWidths(2, 7, 125);
  f.getRange(4, 8, liste.length + 1, 1).setNumberFormat('0%');
  actualiserSuivi_(f.getParent());
}

function actualiserSuivi() {
  actualiserSuivi_(SpreadsheetApp.getActiveSpreadsheet());
  SpreadsheetApp.getActiveSpreadsheet().toast('Suivi actualisé.', 'PTEM 2027', 5);
}

/**
 * Les formules utilisent des PLAGES NOMMÉES et non des lettres de colonnes,
 * afin qu'un réordonnancement de ADMIN_COLUMNS ne casse plus le suivi.
 */
function actualiserSuivi_(ss) {
  var f = ss.getSheetByName(PTEM2.fSuivi), maitre = ss.getSheetByName(PTEM2.fMaitre);
  if (!f || !maitre) return;
  var entetes = maitre.getRange(1, 1, 1, maitre.getLastColumn()).getValues()[0]
    .map(function(v) { return String(v || '').trim(); });
  var cRls = entetes.indexOf('RLS') + 1;
  var cStatut = entetes.indexOf('Statut de validation') + 1;
  if (cRls < 1 || cStatut < 1) throw new Error('Colonnes « RLS » ou « Statut de validation » introuvables.');
  var maxL = 501;
  ss.setNamedRange('PTEM_RLS', maitre.getRange(2, cRls, maxL - 1, 1));
  ss.setNamedRange('PTEM_STATUT', maitre.getRange(2, cStatut, maxL - 1, 1));

  var liste = RLS.filter(function(v) { return v !== 'À confirmer'; });
  var r0 = 4;
  liste.forEach(function(_, i) {
    var r = r0 + i;
    f.getRange(r, 2).setFormula('=COUNTIF(PTEM_RLS,$A' + r + ')');
    f.getRange(r, 3).setFormula('=COUNTIFS(PTEM_RLS,$A' + r + ',PTEM_STATUT,"À valider")');
    f.getRange(r, 4).setFormula('=COUNTIFS(PTEM_RLS,$A' + r + ',PTEM_STATUT,"Envoyé à la clinique")');
    f.getRange(r, 5).setFormula('=COUNTIFS(PTEM_RLS,$A' + r + ',PTEM_STATUT,"Réponse reçue")' +
      '+COUNTIFS(PTEM_RLS,$A' + r + ',PTEM_STATUT,"Validé")' +
      '+COUNTIFS(PTEM_RLS,$A' + r + ',PTEM_STATUT,"À corriger")');
    f.getRange(r, 6).setFormula('=COUNTIFS(PTEM_RLS,$A' + r + ',PTEM_STATUT,"Validé")');
    f.getRange(r, 7).setFormula('=COUNTIFS(PTEM_RLS,$A' + r + ',PTEM_STATUT,"À corriger")');
    f.getRange(r, 8).setFormula('=IF($B' + r + '=0,0,$E' + r + '/$B' + r + ')');
  });
  var rT = r0 + liste.length;
  for (var c = 2; c <= 7; c++) {
    var L = colonneA1_(c);
    f.getRange(rT, c).setFormula('=SUM(' + L + r0 + ':' + L + (rT - 1) + ')');
  }
  f.getRange(rT, 8).setFormula('=IF($B' + rT + '=0,0,$E' + rT + '/$B' + rT + ')');
}

function construireExport_(f) {
  f.clear();
  f.getRange('A1:B1').merge()
    .setValue('PRÉPARATION INTERNE — aucune publication automatique')
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#674EA7').setHorizontalAlignment('center');
  f.getRange('A2:B2').merge()
    .setValue('Le JSON complet est écrit comme fichier dans votre Drive : une cellule de Google Sheets ne peut pas contenir plus de 50 000 caractères. Ce script ne publie rien et ne partage rien.')
    .setWrap(true).setBackground('#EADCF8');
  f.getRange('A4:B4').setValues([['Rapport de contrôle','Fichier d’export']]);
  f.getRange('A4:B4').setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#674EA7');
  f.setFrozenRows(4);
  f.setHiddenGridlines(true);
  f.setColumnWidth(1, 520);
  f.setColumnWidth(2, 420);
  f.getRange('A5:B6').setVerticalAlignment('top').setWrap(true);
}

/* =====================================================================
 * UTILITAIRES
 * ===================================================================== */

function objetDepuisLigne_(entetes, ligne, cols) {
  var parTitre = {};
  entetes.forEach(function(t, i) { parTitre[t] = ligne[i]; });
  var o = {};
  cols.forEach(function(c) {
    o[c.key] = parTitre[c.title] === undefined ? '' : parTitre[c.title];
  });
  return o;
}

function colonneA1_(n) {
  var s = '';
  while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
