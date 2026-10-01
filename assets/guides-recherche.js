/* Moteur de recherche du catalogue clinique (/guides/).
   Chargé tel quel par la page et par scripts/test-recherche-guides.cjs.
   - Synonymes et abréviations (MPOC = BPCO = COPD, FA = fibrillation auriculaire…).
   - Tolérance au pluriel et aux fautes de frappe (distance d'édition 1, ou 2 sur les mots longs).
   - Abréviations courtes (3 lettres ou moins) : mot entier seulement, donc « FA » ne trouve pas « famille ».
   - Questions en phrase complète : un guide qui répond à une partie de la question reste
     proposé ; les mots rares (« apixaban ») pèsent plus que les mots courants (« enfant »).
   - Pertinence : titre avant organisme, catégorie, mots-clés, puis description.
   - Dictionnaire de concepts (CONCEPTS) : relie un mot de la question aux sujets du catalogue
     (apixaban -> anticoagulant). À enrichir quand une recherche réelle ne trouve rien. */
(function (racine) {
  'use strict';

  const MOTS_VIDES = new Set(['a', 'au', 'aux', 'avec', 'chez', 'd', 'de', 'des', 'du', 'en', 'et', 'l', 'la', 'le', 'les', 'ou', 'par', 'pour', 'sur', 'un', 'une', 'the', 'of', 'and', 'in', 'for']);
  /* Mots de question sans valeur de recherche (mis au singulier plus bas, comme la requête). */
  const MOTS_QUESTION = 'patient patiente personne homme avant apres sous depuis quel quelle quels quelles option options comment faire cas sans dans mon ma mes son sa ses leur qui que quoi est sont doit doivent peut peux faut il elle ce cette ces plus moins semaine semaines jour jours mois an ans annee annees age agee ayant atteint atteinte traiter prendre quoi aide besoin trouver ressource service organisme';

  /* Chaque groupe réunit des expressions équivalentes. Écrire sans accents, en minuscules. */
  const GROUPES = [
    ['entorse', 'entorses', 'foulure', 'sprain'],
    /* Abréviations cliniques courantes au Québec (29 sept. 2026, demande du propriétaire : « OMI »). */
    ['omi', 'oedeme des membres inferieurs', 'oedeme membre inferieur', 'oedeme des jambes', 'jambes enflees', 'jambe enflee', 'pieds enfles', 'enflure des jambes', 'lymphoedeme'],
    ['ecg', 'ekg', 'electrocardiogramme', 'holter'],
    ['fsc', 'formule sanguine', 'formule sanguine complete', 'cbc', 'hemogramme'],
    ['hba1c', 'a1c', 'hemoglobine glyquee', 'glycemie'],
    ['dfg', 'dfge', 'debit de filtration glomerulaire', 'egfr', 'clairance de la creatinine', 'creatinine'],
    ['ira', 'insuffisance renale aigue', 'atteinte renale aigue', 'aki'],
    ['mcas', 'maladie coronarienne', 'coronaropathie', 'cardiopathie ischemique', 'angine', 'angor'],
    ['map', 'maladie arterielle peripherique', 'maladie vasculaire peripherique', 'claudication', 'claudication intermittente', 'ischemie des membres inferieurs'],
    ['saos', 'sahos', 'apnee du sommeil', 'apnee obstructive du sommeil', 'apnee obstructive', 'sleep apnea', 'cpap', 'ppc'],
    ['sep', 'sclerose en plaques', 'multiple sclerosis'],
    ['sla', 'sclerose laterale amyotrophique', 'als'],
    ['polyarthrite rhumatoide', 'arthrite rhumatoide', 'rheumatoid arthritis'],
    ['ppr', 'pseudopolyarthrite rhizomelique', 'polymyalgia rheumatica', 'pmr', 'polymyalgie rhumatismale'],
    ['led', 'lupus', 'lupus erythemateux', 'lupus erythemateux dissemine', 'lupus erythemateux systemique'],
    ['mici', 'mii', 'maladie inflammatoire de l intestin', 'maladies inflammatoires de l intestin', 'maladie de crohn', 'crohn', 'colite ulcereuse', 'ibd'],
    ['hsa', 'hemorragie sous arachnoidienne', 'hemorragie meningee'],
    ['ivrs', 'infection des voies respiratoires superieures', 'rhume', 'urti'],
    ['sua', 'saignement uterin anormal', 'saignements uterins anormaux', 'menorragie', 'menometrorragie', 'metrorragie', 'regles abondantes'],
    ['sgum', 'syndrome genito urinaire de la menopause', 'atrophie vaginale', 'atrophie vulvovaginale', 'secheresse vaginale', 'vaginite atrophique'],
    ['vrs', 'rsv', 'virus respiratoire syncytial', 'bronchiolite'],
    ['asa', 'aspirine', 'acide acetylsalicylique'],
    ['ieca', 'inhibiteur de l enzyme de conversion', 'inhibiteurs de l enzyme de conversion', 'ramipril', 'perindopril'],
    ['ara', 'antagoniste des recepteurs de l angiotensine', 'bloqueur des recepteurs de l angiotensine', 'sartan', 'losartan', 'candesartan'],
    ['isrs', 'ssri', 'inhibiteur selectif du recaptage de la serotonine', 'sertraline', 'escitalopram', 'citalopram', 'fluoxetine', 'paroxetine'],
    ['irsn', 'snri', 'venlafaxine', 'duloxetine', 'desvenlafaxine'],
    ['dmo', 'densitometrie', 'densite minerale osseuse', 'osteodensitometrie'],
    ['vph', 'hpv', 'virus du papillome humain', 'condylome', 'condylomes'],
    ['hsv', 'herpes', 'herpes simplex', 'feu sauvage', 'herpes genital'],
    ['sarm', 'mrsa', 'staphylocoque dore resistant'],
    ['vzv', 'varicelle', 'chickenpox'],
    ['rro', 'rougeole', 'measles'],
    ['scpd', 'symptomes comportementaux et psychologiques de la demence', 'agitation', 'comportement difficile'],
    ['delirium', 'etat confusionnel', 'confusion aigue', 'delire aigu'],
    ['tomodensitometrie', 'scan', 'ct scan', 'scanner'],
    ['irm', 'resonance magnetique', 'mri'],
    ['echographie', 'echo', 'ultrason', 'echographie au chevet', 'pocus'],
    ['rx', 'radiographie', 'radiographies', 'rayon x', 'rayons x', 'x ray'],
    ['goutte', 'hyperuricemie', 'acide urique', 'crise de goutte'],
    ['dermatite atopique', 'eczema', 'eczema atopique', 'atopic dermatitis'],
    ['diabete gestationnel', 'hgpo', 'hyperglycemie provoquee', 'test de tolerance au glucose'],
    ['nvg', 'nausees de grossesse', 'nausees et vomissements de la grossesse', 'hyperemese', 'hyperemese gravidique'],
    ['pqdcs', 'programme quebecois de depistage du cancer du sein'],
    ['rcr', 'reanimation'],
    ['mpoc', 'bpco', 'copd', 'maladie pulmonaire obstructive chronique', 'emphyseme'],
    ['fa', 'fibrillation auriculaire', 'fibrillation atriale', 'atrial fibrillation'],
    ['tvp', 'thrombose veineuse profonde', 'dvt', 'deep vein thrombosis', 'phlebite'],
    ['ep', 'embolie pulmonaire', 'pulmonary embolism'],
    ['tev', 'thromboembolie veineuse', 'vte'],
    ['ic', 'icc', 'insuffisance cardiaque', 'heart failure'],
    ['hta', 'hypertension', 'hypertension arterielle', 'haute pression', 'pression haute', 'pression elevee', 'tension arterielle', 'haute tension', 'pression arterielle'],
    ['itss', 'its', 'ist', 'mts', 'infections transmissibles sexuellement', 'sti', 'std'],
    ['ivu', 'infection urinaire', 'cystite', 'pyelonephrite', 'uti', 'dysurie', 'brulure en urinant', 'brulures en urinant', 'douleur en urinant', 'brule en urinant', 'brulure mictionnelle'],
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
    ['pediatrie', 'pediatrique', 'enfant', 'nourrisson', 'bebe', 'nouveau ne', 'neonatal', 'neonatale'],
    ['c difficile', 'c diff', 'cdiff', 'clostridium difficile', 'clostridioides difficile'],
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
    ['epipen', 'anaphylaxie', 'anaphylactique', 'choc anaphylactique', 'reaction anaphylactique', 'epinephrine', 'adrenaline'],
    ['oeil rouge', 'yeux rouges', 'oeil rouge douloureux', 'conjonctivite', 'red eye'],
    /* Banc d'essai du 1er oct. 2026 : recherches courantes qui ne trouvaient rien ou le mauvais sujet. */
    ['cephalee', 'cephalees', 'mal de tete', 'maux de tete'],
    ['dysmenorrhee', 'regles douloureuses', 'crampes menstruelles', 'douleurs menstruelles', 'menstruations douloureuses'],
    ['rectorragie', 'rectorragies', 'saignement rectal', 'saignements rectaux', 'sang dans les selles', 'saignement anal'],
    ['ulcere veineux', 'ulceres veineux', 'ulcere de jambe', 'ulceres de jambe', 'ulcere de la jambe', 'plaie de jambe'],
    ['saignement postmenopausique', 'saignements postmenopausiques', 'saignement post menopause', 'saignement apres la menopause', 'metrorragie postmenopausique'],
    ['nodule pulmonaire', 'nodules pulmonaires', 'masse pulmonaire'],
    ['eruption cutanee', 'eruptions cutanees', 'rash', 'exantheme', 'exanthemes', 'maladies eruptives'],
    ['poux', 'pediculose', 'poux de tete'],
    ['onychomycose', 'onychopathie', 'mycose des ongles', 'ongle', 'ongles'],
    ['autochtone', 'autochtones', 'premieres nations', 'inuit', 'inuits', 'metis', 'securisation culturelle'],
    ['transgenre', 'trans', 'non binaire', 'affirmation de genre', 'diversite de genre', 'pluralite de genre'],
    ['voyage', 'voyageur', 'voyageurs', 'sante voyage', 'medecine des voyages', 'consultation prevoyage'],
    ['retour au travail', 'arret de travail', 'invalidite', 'cnesst', 'accident du travail'],
    ['trouble d apprentissage', 'troubles d apprentissage', 'dyslexie', 'difficultes scolaires', 'dyscalculie'],
    ['sante buccodentaire', 'buccodentaire', 'dents', 'dentaire', 'carie', 'caries'],
    ['ecoresponsable', 'soins durables', 'sante planetaire', 'climat', 'environnement'],
    ['idees suicidaires', 'risque suicidaire', 'potentiel suicidaire', 'suicide', 'suicidaire'],
    ['epistaxis', 'saignement de nez', 'saignement nasal', 'saignements de nez', 'nez qui saigne'],
    ['benzodiazepine', 'benzo', 'sedatif hypnotique', 'somnifere', 'hypnotique', 'bzra', 'z drug', 'lorazepam', 'ativan', 'clonazepam', 'rivotril', 'alprazolam', 'xanax', 'oxazepam', 'zopiclone', 'imovane'],
    ['tsa', 'autisme', 'trouble du spectre de l autisme', 'asd'],
    ['aaa', 'anevrisme de l aorte abdominale', 'anevrisme aortique', 'anevrisme aorte'],
    ['aps', 'psa', 'antigene prostatique specifique', 'depistage prostate'],
    ['hormonotherapie', 'ths', 'traitement hormonal', 'hormonotherapie de la menopause', 'oestrogene'],
    ['neuropathie', 'douleur neuropathique', 'neuropathique'],
    ['canrisk', 'risque de diabete', 'prediabete'],
    ['anemie', 'hemoglobine basse', 'ferritine basse', 'carence en fer'],
    ['vulvodynie', 'vestibulodynie', 'dyspareunie'],
    ['lombalgie', 'mal de dos', 'douleur lombaire', 'lumbago', 'sciatique', 'lombosciatalgie'],
    ['gonalgie', 'douleur au genou', 'mal au genou', 'genou'],
    ['epaule douloureuse', 'douleur a l epaule', 'mal a l epaule', 'epaule'],
    ['ipp', 'inhibiteur de la pompe a protons', 'inhibiteurs de la pompe a protons', 'pompe a protons', 'pompe a proton', 'pompeproton', 'omeprazole', 'pantoprazole', 'esomeprazole', 'rabeprazole', 'lansoprazole', 'dexlansoprazole'],
    ['rgo', 'reflux', 'reflux gastro-oesophagien', 'brulure d estomac', 'pyrosis'],
    ['vertige', 'vppb', 'vertige positionnel'],
    ['hepatite b', 'vhb', 'hbv'],
    ['hepatite c', 'vhc', 'hcv'],
    ['hepatite a', 'vha', 'hav'],
    /* « MRC » n'est pas dans ce groupe : c'est aussi la « municipalité régionale de comté » (« MRC d'Acton ») ;
       sinon « insuffisance rénale chronique » ramenait le transport de la MRC d'Acton. Voir CONCEPTS. */
    ['irc', 'insuffisance renale', 'insuffisance renale chronique', 'maladie renale chronique', 'maladie renale', 'ckd', 'chronic kidney disease', 'nephropathie', 'dfg', 'dfge'],
    ['hbp', 'hypertrophie benigne de la prostate', 'hyperplasie benigne de la prostate', 'prostatisme'],
    ['prep', 'prophylaxie pre exposition', 'prophylaxie preexposition'],
    ['ppe', 'prophylaxie post exposition', 'prophylaxie postexposition'],
    ['cancer du col', 'cancer du col de l uterus', 'col de l uterus', 'col uterin', 'cytologie cervicale', 'test pap', 'pap test', 'papanicolaou'],
    ['cancer du sein', 'mammographie', 'depistage du sein'],
    ['masse au sein', 'masse mammaire', 'masse du sein', 'bosse au sein', 'boule au sein', 'nodule du sein', 'nodule mammaire', 'breast lump'],
    ['mastite', 'mastites', 'abces du sein', 'abces mammaire', 'mastitis'],
    ['sii', 'syndrome de l intestin irritable', 'intestin irritable', 'colon irritable', 'ibs'],
    ['vessie hyperactive', 'vessie instable', 'urgenturie', 'hyperactivite vesicale'],
    ['incontinence urinaire', 'incontinence', 'fuites urinaires', 'fuite urinaire'],
    ['dysfonction erectile', 'troubles de l erection', 'impuissance'],
    ['calcul renal', 'calculs renaux', 'lithiase', 'lithiase urinaire', 'nephrolithiase', 'pierres aux reins', 'colique nephretique'],
    ['toc', 'trouble obsessionnel compulsif', 'trouble obsessionnel-compulsif', 'ocd'],
    ['tspt', 'espt', 'stress post traumatique', 'trouble de stress post traumatique', 'ptsd'],
    ['lesion de pression', 'lesions de pression', 'plaie de pression', 'escarre', 'escarres', 'ulcere de decubitus'],
    ['tcci', 'therapie cognitivo comportementale de l insomnie', 'cbt i'],
    ['carence en fer', 'carence martiale', 'ferriprive', 'anemie ferriprive'],
    ['vitamine b12', 'b12', 'cobalamine'],
    ['enuresie', 'pipi au lit', 'incontinence nocturne'],
    ['pertes vaginales', 'vaginite', 'vaginose', 'leucorrhees'],
    ['syndrome des jambes sans repos', 'jambes sans repos', 'sjsr', 'impatiences', 'willis ekbom', 'restless legs'],
    ['trouble alimentaire', 'troubles alimentaires', 'tca', 'trouble des conduites alimentaires', 'anorexie', 'boulimie'],
    ['inhalateur', 'pompe', 'aerosol doseur', 'dispositif d inhalation', 'chambre d espacement', 'aerochamber'],
    ['urticaire', 'hives'],
    ['ictere', 'jaunisse', 'hyperbilirubinemie', 'bilirubine'],
    ['vaginite', 'vaginose', 'vaginose bacterienne', 'vulvovaginite', 'pertes vaginales', 'candidose vaginale'],
    ['cessation tabagique', 'arret tabagique', 'arret du tabac', 'renoncement au tabac', 'abandon du tabac', 'abandon du tabagisme', 'j arrete', 'jarrete', 'arreter de fumer', 'arret de fumer', 'cesser de fumer', 'arreter la cigarette'],
    ['hypothyroidie', 'thyroide', 'tsh', 'levothyroxine', 'synthroid'],
    ['preeclampsie', 'pre eclampsie', 'hypertension gestationnelle'],
    ['hemorroide', 'hemorroides'],
    ['deprescription', 'deprescrire', 'sevrage medicament', 'cessation medicament'],
    /* Plan Guides du 27 sept. 2026 (proposition 21). « pied » (programme PIED) et « détresse » seule ne sont pas
       dans ces groupes : ils ramèneraient le pied diabétique et la détresse respiratoire. */
    ['ivg', 'avortement', 'interruption de grossesse', 'interruption volontaire de grossesse', 'pilule abortive', 'mifegymiso'],
    ['sterilet', 'diu', 'dispositif intra uterin', 'dispositif intra-uterin', 'mirena', 'kyleena', 'jaydess', 'sterilet de cuivre'],
    ['sopk', 'syndrome des ovaires polykystiques', 'ovaires polykystiques', 'pcos'],
    ['spc', 'sedation palliative continue', 'sedation palliative'],
    ['tuo', 'tluo', 'trouble lie a l usage d opioides', 'trouble lie a l usage des opioides', 'trouble lie a l usage de substances opioides', 'dependance aux opioides'],
    ['tag', 'trouble d anxiete generalisee', 'anxiete generalisee', 'anxiete', 'trouble anxieux', 'troubles anxieux', 'trouble panique'],
    ['trouble bipolaire', 'bipolaire', 'maladie bipolaire', 'maniaco depression', 'maniaco depressif'],
    ['inaptitude', 'mandat de protection', 'homologation', 'tutelle', 'curatelle', 'regime de protection', 'curateur public'],
    ['saaq', 'permis de conduire', 'aptitude a conduire', 'conduite automobile', 'aptitude a la conduite'],
    ['chute', 'prevention des chutes', 'chute chez l aine', 'risque de chute'],
    ['acne', 'isotretinoine', 'accutane', 'epuris'],
    ['epuisement professionnel', 'burnout', 'burn out', 'sante des medecins', 'pamq', 'medecin en detresse', 'programme d aide aux medecins'],
    ['cannabis', 'marijuana', 'marihuana', 'thc', 'cbd'],
    /* Ressources communautaires (sans mots vides : « aide », « de »… sont retirés de la requête). */
    ['banque alimentaire', 'aide alimentaire', 'depannage alimentaire', 'comptoir alimentaire', 'distribution alimentaire', 'nourriture', 'epicerie', 'panier noel', 'paniers de noel'],
    ['hebergement', 'refuge', 'gite', 'sans abri', 'sans-abri', 'itinerance', 'itinerant', 'maison hebergement', 'maison d hebergement'],
    ['popote roulante', 'repas livre', 'repas bas prix', 'repas a bas prix', 'soupe populaire'],
    ['violence conjugale', 'violence familiale', 'femme violentee'],
    ['proche aidant', 'aidant naturel', 'repit', 'aide naturel'],
    ['ligne ecoute', 'ligne d ecoute', 'ecoute telephonique', 'tel-aide'],
    ['toxicomanie', 'dependance', 'drogue'],
    ['logement', 'appartement', 'loyer', 'hlm'],
    ['friperie', 'vetement', 'meuble', 'comptoir familial'],
    ['impot', 'declaration revenu', 'rapport impot', 'rapport d impot', 'declaration de revenus'],
    ['juridique', 'avocat', 'aide juridique'],
    ['emploi', 'recherche emploi', 'recherche d emploi', 'insertion professionnelle'],
    ['alphabetisation', 'francisation']
  ];

  /* Concepts : un mot de la question (à gauche) mène aussi aux sujets du catalogue (à droite).
     Contrairement aux GROUPES, la relation est à sens unique : « apixaban » trouve les guides
     sur les anticoagulants, mais « anticoagulant » ne cherche pas « apixaban ». */
  const CONCEPTS = [
    [['dysmenorrhee', 'regles douloureuses', 'crampes menstruelles', 'douleurs menstruelles', 'menstruations douloureuses'], ['endometriose', 'douleur pelvienne', 'saignements uterins anormaux']],
    [['rectorragie', 'rectorragies', 'saignement rectal', 'saignements rectaux', 'sang dans les selles', 'saignement anal'], ['hemorroides', 'anorectaux', 'cancer colorectal', 'cancer du colon']],
    [['saignement postmenopausique', 'saignements postmenopausiques', 'saignement post menopause', 'saignement apres la menopause', 'metrorragie postmenopausique'], ['cancer de l endometre', 'saignements uterins anormaux']],
    [['nodule pulmonaire', 'nodules pulmonaires', 'masse pulmonaire'], ['cancer du poumon', 'decouvertes fortuites']],
    [['engourdissement', 'engourdissements', 'fourmillements', 'paresthesie', 'paresthesies', 'picotements'], ['neuropathie', 'neuropathies']],
    [['oeil rouge', 'yeux rouges', 'conjonctivite'], ['blepharite', 'zona ophtalmique', 'herpes simplex']],
    [['ieca', 'ara', 'inhibiteur de l enzyme de conversion', 'antagoniste des recepteurs de l angiotensine', 'ramipril', 'perindopril', 'sartan', 'losartan', 'candesartan'], ['hypertension', 'insuffisance cardiaque', 'insuffisance renale']],
    [['irm', 'resonance magnetique', 'tomodensitometrie', 'scan', 'scanner', 'rx', 'radiographie', 'echographie', 'imagerie'], ['imagerie']],
    [['tdm', 'trouble depressif majeur'], ['depression']],
    [['ira', 'insuffisance renale aigue', 'atteinte renale aigue'], ['insuffisance renale', 'creatinine']],
    [['apixaban', 'rivaroxaban', 'dabigatran', 'edoxaban', 'eliquis', 'xarelto', 'pradaxa', 'lixiana'], ['anticoagulant', 'anticoagulants oraux directs', 'anticoagulotherapie']],
    [['heparine', 'hbpm', 'enoxaparine', 'tinzaparine', 'dalteparine'], ['anticoagulant', 'heparine']],
    [['coloscopie', 'endoscopie', 'gastroscopie', 'chirurgie', 'intervention', 'operation', 'procedure'], ['chirurgie', 'perioperatoire', 'procedure']],
    [['fumeur', 'fumeuse', 'tabac', 'tabagisme', 'cigarette', 'vapotage', 'nicotine'], ['mpoc', 'poumon', 'tabac', 'cessation tabagique']],
    [['bouffee de chaleur', 'bouffees de chaleur', 'sueurs nocturnes'], ['menopause', 'vasomoteur']],
    [['toux'], ['bronchite', 'respiratoire']],
    [['essoufflement', 'dyspnee'], ['mpoc', 'asthme', 'insuffisance cardiaque']],
    [['dysurie', 'brulure mictionnelle', 'brulures mictionnelles'], ['infection urinaire']],
    [['mal d oreille', 'otalgie'], ['otite']],
    [['amoxicilline', 'amoxil', 'cephalosporine', 'cephalexine'], ['penicilline', 'beta lactamine', 'antibiotique']],
    [['metformine', 'insuline', 'sglt2', 'glp1', 'hba1c', 'glycemie'], ['diabete']],
    [['ozempic', 'wegovy', 'semaglutide', 'tirzepatide', 'mounjaro', 'poids', 'surpoids', 'imc'], ['obesite', 'diabete']],
    [['sertraline', 'citalopram', 'escitalopram', 'fluoxetine', 'venlafaxine', 'isrs', 'antidepresseur'], ['depression', 'antidepresseur']],
    [['ritalin', 'methylphenidate', 'vyvanse', 'concerta', 'lisdexamfetamine'], ['tdah']],
    [['alendronate', 'fosamax', 'risedronate', 'denosumab', 'prolia', 'densitometrie'], ['osteoporose', 'osteodensitometrie']],
    [['douleur thoracique', 'angine de poitrine', 'angor'], ['syndrome coronarien', 'infarctus']],
    [['palpitation', 'palpitations'], ['arythmie', 'fibrillation auriculaire']],
    [['mollet', 'jambe enflee', 'oedeme du membre inferieur'], ['thrombose veineuse profonde']],
    [['memoire', 'oubli', 'confusion'], ['troubles neurocognitifs']],
    [['sommeil', 'dormir'], ['insomnie']],
    [['mal de dos', 'lombalgie', 'arthrose', 'douleur chronique'], ['douleur chronique', 'lombaire']],
    [['grippe'], ['influenza']],
    [['pilule', 'sterilet', 'sterilet hormonal', 'contraceptif'], ['contraception']],
    [['coupure', 'plaie', 'suture'], ['laceration']],
    [['morsure', 'chauve souris'], ['rage']],
    [['suicide', 'suicidaire', 'idees suicidaires'], ['sante mentale', 'detresse']],
    [['alcool', 'alcoolisme'], ['alcool', 'sevrage']],
    [['entorse', 'cheville'], ['entorse', 'traumatisme musculosquelettique']],
    [['salbutamol', 'ventolin', 'airomir', 'bricanyl', 'terbutaline', 'fluticasone', 'flovent', 'budesonide', 'pulmicort', 'symbicort', 'advair', 'breo', 'trelegy', 'spiriva', 'tiotropium', 'montelukast', 'singulair', 'corticosteroide inhale', 'csi', 'bronchodilatateur'], ['asthme', 'mpoc', 'inhalation']],
    [['urticaire', 'hives'], ['allergie', 'anaphylaxie']],
    [['tetanos', 'dcat', 'dcat polio'], ['vaccin', 'laceration', 'plaie']],
    [['cancer du sein', 'mammographie', 'depistage du sein', 'cancer du col', 'test pap', 'cytologie cervicale'], ['depistage des cancers']],
    [['suboxone', 'buprenorphine', 'methadone', 'tuo', 'trouble lie a l usage des opioides'], ['opioide', 'naloxone']],
    [['cessation tabagique', 'arret tabagique', 'tabagique', 'nicotine', 'champix', 'varenicline', 'zyban', 'bupropion'], ['mpoc', 'depistage du cancer du poumon', 'tabac']],
    [['ictere', 'jaunisse', 'bilirubine'], ['bilirubine', 'nouveau ne']],
    [['vaginite', 'vaginose', 'candidose vaginale', 'pertes vaginales'], ['trichomonas', 'pertes vaginales']],
    [['prep', 'prophylaxie pre exposition'], ['vih']],
    [['hepatite b', 'vhb', 'hepatite c', 'vhc', 'hepatite a', 'vha'], ['hepatite']],
    [['hbp', 'prostatisme'], ['prostate']],
    [['irc', 'insuffisance renale', 'maladie renale chronique', 'dfg'], ['kidney', 'renale']],
    /* Sens unique : « MRC » tapé seul mène aussi aux guides sur le rein, mais une question sur le rein ne cherche pas « MRC ». */
    [['mrc'], ['insuffisance renale', 'maladie renale chronique', 'kidney']],
    [['lithium', 'manie'], ['trouble bipolaire']],
    [['detresse'], ['sante mentale', 'epuisement professionnel']],
    [['equilibre', 'aine qui tombe', 'tombe souvent'], ['chute']],
    [['fin de vie', 'soins de fin de vie'], ['soins palliatifs', 'aide medicale a mourir', 'sedation palliative continue']],
    [['tsh', 'hypothyroidie', 'thyroide'], ['thyroide', 'hormones thyroidiennes']]
  ];

  /* Mots génériques : utiles pour départager, mais ils ne suffisent jamais seuls à retenir un
     guide quand la question contient aussi un mot précis (« toux chronique » ne doit pas ramener
     « constipation chronique » ; « insuffisance rénale » pas « insuffisance cardiaque »). */
  const MOTS_GENERIQUES_TEXTE = 'eleve elevee eleves elevees haut haute bas basse faible faibles augmente augmentee diminue diminuee anormal anormale anormaux chronique aigu aigue subaigu recidivant recurrent severe grave leger moderee insuffisance douleur mal cancer infection trouble syndrome maladie traitement prise charge guide enfant adulte bebe nourrisson adolescent ado jeune homme femme age agee aine status choc nouveau ne neonatal neonatale arret test examen bilan suivi evaluation diagnostic prevention signe symptome complication';
  const POIDS_GENERIQUE = 0.5;

  function normaliser(texte) {
    return String(texte || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
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
  const utilesSeulement = liste => liste.filter(t => !MOTS_VIDES.has(t));
  const EXPANSIONS = new Map(); // phrase de question normalisée -> sujets du catalogue
  CONCEPTS.forEach(([cles, sujets]) => cles.forEach(c => {
    const cle = utilesSeulement(mots(c)).join(' ');
    EXPANSIONS.set(cle, (EXPANSIONS.get(cle) || []).concat(sujets.map(mots)));
  }));
  const LONGUEUR_MAX_TOUT = Math.max(LONGUEUR_MAX, ...[...EXPANSIONS.keys()].map(p => p.split(' ').length));
  mots(MOTS_QUESTION).forEach(m => MOTS_VIDES.add(m));
  const GENERIQUES = new Set(mots(MOTS_GENERIQUES_TEXTE));

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
  function qualiteMot(q, m, dernier, flou, strict) {
    if (q === m) return 1;
    if (strict || q.length <= 3) return 0;             // terme reconnu ou abréviation courte : mot entier
    if (m.startsWith(q)) return dernier ? 0.9 : 0.8;   // saisie en cours ou mot tronqué
    /* Mots courts : la première lettre doit correspondre (« deuil » n'est pas « seuil »). */
    /* Distance 2 seulement sur les mots longs dont le début concorde : « fibrilation » trouve
       « fibrillation », mais « urticaire » ne devient pas « urinaire », ni « jaunisse » « jeunesse ». */
    const max = !flou ? 0 : q.length >= 8 && q.slice(0, 3) === m.slice(0, 3) ? 2 : q.length >= 5 && q[0] === m[0] ? 1 : 0;
    if (max && distance(q, m, max) <= max) return 0.6;
    return 0;
  }

  /* Une phrase (suite de mots) se trouve-t-elle dans la liste de mots du champ ? */
  function qualitePhrase(phrase, champ, dernier, flou, strict) {
    let meilleure = 0;
    for (let i = 0; i + phrase.length <= champ.length; i++) {
      let q = 1;
      for (let k = 0; k < phrase.length && q > 0; k++) q = Math.min(q, qualiteMot(phrase[k], champ[i + k], dernier && k === phrase.length - 1, flou, strict));
      if (q > meilleure) meilleure = q;
      if (meilleure === 1) break;
    }
    return meilleure;
  }

  /* Découpe la requête en termes ; chaque terme a une ou plusieurs formulations équivalentes
     (synonymes) et, au besoin, des sujets liés (concepts). Les chiffres seuls (« 3 semaines »,
     « 60 ans ») et les mots de question sont ignorés, sauf s'il ne reste rien d'autre. */
  function analyserRequete(requete) {
    const tokens = mots(requete);
    const termes = [];
    /* D'abord les expressions de GROUPES qui contiennent un mot vide (« aide alimentaire »,
       « sans abri », « ligne d'écoute ») : elles disparaîtraient une fois les mots vides retirés. */
    const reste = [];
    for (let i = 0; i < tokens.length;) {
      let pris = 0;
      for (let n = Math.min(LONGUEUR_MAX, tokens.length - i); n >= 2 && !pris; n--) {
        const seg = tokens.slice(i, i + n);
        const phrase = seg.join(' ');
        if (seg.some(t => MOTS_VIDES.has(t)) && PHRASES.has(phrase)) {
          termes.push({ alternatives: ALTERNATIVES[PHRASES.get(phrase)], expansions: EXPANSIONS.get(utilesSeulement(seg).join(' ')) || [], saisie: seg, dernier: i + n === tokens.length, connu: true, generique: seg.every(t => GENERIQUES.has(t) || MOTS_VIDES.has(t)) });
          pris = n;
        }
      }
      if (pris) i += pris; else reste.push(tokens[i++]);
    }
    const utiles = reste.filter(t => !MOTS_VIDES.has(t) && !/^\d+$/.test(t));
    const liste = utiles.length || termes.length ? utiles : reste;
    for (let i = 0; i < liste.length;) {
      let trouve = false;
      for (let n = Math.min(LONGUEUR_MAX_TOUT, liste.length - i); n >= 1 && !trouve; n--) {
        const phrase = liste.slice(i, i + n).join(' ');
        if (PHRASES.has(phrase) || EXPANSIONS.has(phrase)) {
          termes.push({
            alternatives: PHRASES.has(phrase) ? ALTERNATIVES[PHRASES.get(phrase)] : [liste.slice(i, i + n)],
            expansions: EXPANSIONS.get(phrase) || [],
            saisie: liste.slice(i, i + n), dernier: i + n === liste.length,
            /* Terme du dictionnaire (« PrEP », « IRC ») : correspondance exacte, sans préfixe
               (« prep » ne doit pas trouver « prépubère »). */
            connu: PHRASES.has(phrase) && (n > 1 || liste[i].length <= 4),
            generique: liste.slice(i, i + n).every(t => GENERIQUES.has(t))
          });
          i += n; trouve = true;
        }
      }
      if (!trouve && liste[i].length === 1 && liste.length > 1) { i++; continue; }
      if (!trouve) { termes.push({ alternatives: [[liste[i]]], expansions: [], saisie: [liste[i]], dernier: i === liste.length - 1, generique: GENERIQUES.has(liste[i]) }); i++; }
    }
    return termes;
  }

  const POIDS = { titre: 10, organisme: 5, categorie: 4, motsCles: 3, description: 1 };

  function preparer(ressource) {
    const champs = {};
    /* « pompe à protons » devient un seul mot dans les guides : « pompe » seul (inhalateur)
       ne ramène donc plus les guides sur les IPP. */
    Object.keys(POIDS).forEach(c => { champs[c] = mots(normaliser(ressource[c]).replace(/\bpompes? a protons?\b/g, 'pompeproton')); });
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
          const q = qualitePhrase(alt, champs[nom], terme.dernier && exact && !terme.connu, terme.flou, terme.connu) * (exact ? 1 : 0.9);
          if (q * poids > meilleur) meilleur = q * poids;
        }
        /* Mots tapés tels quels, même quand un synonyme a été reconnu (ex. « ste-justine »). */
        const q2 = qualitePhrase(terme.saisie, champs[nom], terme.dernier && !terme.connu, terme.flou, terme.connu);
        if (q2 * poids > meilleur) meilleur = q2 * poids;
        /* Sujets liés par le dictionnaire de concepts : comptent un peu moins. */
        for (const sujet of terme.expansions || []) {
          const q3 = qualitePhrase(sujet, champs[nom], false, false) * 0.75;
          if (q3 * poids > meilleur) meilleur = q3 * poids;
        }
      }
      if (!meilleur) return 0;
      total += meilleur;
    }
    return total;
  }

  /* Classement : chaque terme rapporte selon le champ touché et sa rareté dans le catalogue
     (IDF) ; un guide qui couvre plus de termes de la question passe devant. Par défaut, on
     garde les guides qui atteignent au moins le quart du meilleur score (options.seuil). */
  function rechercher(index, requete, options = {}) {
    const termes = analyserRequete(requete);
    if (!termes.length) return index.map((r, i) => ({ i, score: 0 }));
    const N = index.length;
    const stats = termes.map(t => {
      /* Correction des fautes seulement pour un terme introuvable tel quel (« Vouliez-vous dire »),
         sinon « laryngite » ramènerait aussi « pharyngite ». */
      t.flou = false;
      let scores = index.map(champs => score(champs, [t]));
      let df = scores.filter(s => s > 0).length;
      if (!df) { t.flou = true; scores = index.map(champs => score(champs, [t])); df = scores.filter(s => s > 0).length; }
      return { scores, df, inconnu: t.flou, generique: !!t.generique };
    });
    /* Question en bonne partie hors catalogue (au moins la moitié des mots introuvables tels
       quels, ex. « banque alimentaire », « hébergement femme violence ») : mode prudent, seules
       les correspondances fortes (titre ou concept dans le titre) comptent. Sinon, le mot
       restant ramènerait des guides sans rapport. */
    const prudent = termes.length > 1 && stats.filter(s => s.inconnu).length * 2 >= termes.length;
    if (prudent) stats.forEach(s => { s.scores = s.scores.map(v => (v >= POIDS.titre * 0.7 ? v : 0)); s.df = s.scores.filter(v => v > 0).length; });
    stats.splice(0, stats.length, ...stats.filter(s => s.df > 0));
    /* Un terme présent dans plus des deux tiers du catalogue ne départage rien : ignoré s'il en
       reste d'autres. Entre la moitié et les deux tiers (ex. « bébé », relié à tous les guides
       pédiatriques), il compte encore, mais peu : sa rareté (IDF) est faible. */
    const distinctifs = stats.filter(s => s.df <= N * 2 / 3);
    const retenus = distinctifs.length ? distinctifs : stats;
    if (!retenus.length) return [];
    /* Mots génériques : si la question contient un mot précis, un guide doit couvrir au moins
       un mot précis. Si tous les mots précis sont introuvables (« cancer du sein » sans guide sur
       le sein), on ne propose rien plutôt qu'un guide sans rapport. */
    const precisDemandes = termes.some(t => !t.generique);
    const precis = retenus.filter(s => !s.generique);
    if (precisDemandes && !precis.length && termes.length > 1) return [];
    const resultats = [];
    for (let i = 0; i < N; i++) {
      let total = 0, couverts = 0;
      let precisCouverts = 0;
      for (const s of retenus) if (s.scores[i] > 0) {
        total += s.scores[i] * Math.log(1 + N / s.df) * (s.generique ? POIDS_GENERIQUE : 1);
        couverts++;
        if (!s.generique) precisCouverts++;
      }
      if (precis.length && !precisCouverts) continue;
      if (total > 0) resultats.push({ i, score: total * Math.sqrt(couverts / retenus.length) });
    }
    resultats.sort((a, b) => b.score - a.score || a.i - b.i);
    const seuil = resultats.length ? resultats[0].score * (options.seuil ?? 0.25) : 0;
    return resultats.filter(r => r.score >= seuil);
  }

  /* Questions qui visent une ressource communautaire plutôt qu'un guide clinique. */
  const COMMUNAUTAIRE = /\b(communautaires?|organismes?|banques? alimentaires?|aide alimentaire|alimentaires?|nourriture|depannage|popotes?|cuisines? collectives?|hebergement|refuges?|gites?|sans abri|logements?|loyers?|hlm|itinerance|itinerants?|repit|proches? aidants?|aidants?|deuil|benevol\w*|entraide|violence|maisons? de la famille|travailleurs? de rue|211|maintien a domicile|soutien a domicile|popote roulante|transport adapte|juridique|avocat|impots?|friperies?|vetements?|meubles?|centre d action|emploi|alphabetisation|francisation|lignes? d ecoute|lignes? ecoute|ecoute telephonique|toxicomanie|groupes? de soutien|9 ?8 ?8|maisons? de soins palliatifs|perinatalite|relevailles|lgbt\w*|interligne|antipoison|centre antipoison)\b/;
  const estCommunautaire = requete => COMMUNAUTAIRE.test(normaliser(requete));

  /* Classement selon le type de question : une question communautaire fait passer les
     organismes (communautaires[i] vrai) devant ; une question clinique, les guides. L'autre
     type reste possible, mais il doit être nettement plus pertinent pour atteindre le seuil. */
  const DECOTE_TYPE = 0.35;
  function rechercherParType(index, communautaires, requete, options = {}) {
    const visee = estCommunautaire(requete);
    const res = rechercher(index, requete, { seuil: 0 })
      .map(x => ({ i: x.i, score: !!communautaires[x.i] === visee ? x.score : x.score * DECOTE_TYPE }))
      .sort((a, b) => b.score - a.score || a.i - b.i);
    const min = res.length ? res[0].score * (options.seuil ?? 0.25) : 0;
    return res.filter(x => x.score >= min);
  }

  /* Mots de la question introuvables dans tout le catalogue, même avec une faute de frappe (plan
     Guides, 20b) : la page le signale au-dessus des résultats, qui ne reposent alors que sur les
     autres mots. Les mots génériques (« chronique », « enfant ») ne sont pas signalés. */
  function motsAbsents(index, requete) {
    const termes = analyserRequete(requete);
    if (termes.length < 2) return [];
    return termes.filter(t => {
      if (t.generique) return false;
      t.flou = true;
      return !index.some(champs => score(champs, [t]) > 0);
    }).map(t => t.saisie.join(' '));
  }

  const api = { estCommunautaire, rechercherParType, normaliser, mots, analyserRequete, preparer, score, rechercher, motsAbsents, distance, GROUPES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else racine.GuidesRecherche = api;
})(typeof window !== 'undefined' ? window : globalThis);
