#!/usr/bin/env node
/*
 * GÉNÉRATEUR DE PAGES SEO — Trouve ta clinique (trouvetaclinique.ca)
 * =================================================================
 * Créé le 19 août 2026. Ne dépend d'AUCUNE bibliothèque externe : `node scripts/generer-pages-seo.js`
 * à la racine du dépôt suffit.
 *
 * CE QU'IL FAIT
 *   data.json  ──►  cliniques/index.html              (répertoire, hub)
 *                   cliniques/<slug>/index.html       (une page par clinique publiée)
 *                   rls/<slug>/index.html             (une page par RLS ayant des cliniques)
 *                   monteregie-est/rls/index.html     (hub des 3 RLS de l'univers Est, 22 août)
 *                   sitemap.xml                       (toutes les URL du site)
 *
 * POURQUOI
 *   Avant, la liste des cliniques existait en 3 exemplaires tenus à la main (data.json, le bloc
 *   caché de l'accueil, la page /cliniques/). Chaque modification devait être répétée partout et
 *   les copies dérivaient. Désormais data.json est l'UNIQUE source de vérité : on modifie
 *   data.json, on relance ce script, tout le reste se reconstruit.
 *
 * RÈGLES DE SÉCURITÉ DES DONNÉES (à ne pas assouplir sans y réfléchir)
 *   1. LISTE BLANCHE. Seuls les champs listés dans CHAMPS_PUBLICS ci-dessous sortent dans le HTML.
 *      Un nouveau champ ajouté à data.json n'apparaîtra JAMAIS tout seul sur le site public : il
 *      faut l'ajouter ici volontairement. C'est l'inverse d'une liste noire, qui laisserait fuir
 *      tout champ oublié.
 *   2. "notes" NE SORT JAMAIS. C'est le champ réservé aux notes personnelles des usagers.
 *   3. Une CLINIQUE "visible: false" est ignorée dans les pages et le sitemap. Une fiche dont
 *      `categorie` vaut "etablissement" n'a pas de page SEO clinique. Les pages
 *      /monteregie-est/etablissements/ sont générées depuis data-etablissements.json.
 *   4. Les courriels de recrutement SONT publiés (voir PUBLIER_COURRIELS, décision du 2 sept. 2026).
 *   5. On ne copie jamais le HTML de la fiche de l'application (#dp-body / exportFiche) : cette
 *      fiche contient des éléments propres à l'app (notes, boutons). Les pages ci-dessous sont
 *      construites à partir des DONNÉES, pas de l'affichage.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SITE = 'https://trouvetaclinique.ca';

/*
 * Cloudflare Web Analytics — injecté une seule fois par page, juste avant </body>, via le
 * template commun page() ci-dessous. Ajouté le 20 août 2026. Ce script
 * est un <script type="module"> chargé de façon asynchrone par le navigateur : il ne bloque
 * pas le rendu et ne touche à rien d'autre sur la page (pas de cookie, pas de tierce donnée
 * personnelle — mesure de fréquentation agrégée seulement, cf. Cloudflare).
 */
const CLOUDFLARE_ANALYTICS = `<!-- Cloudflare Web Analytics -->
<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"ceb6d077f71c46ffa566fe67de3eb336"}'></script>
<!-- End Cloudflare Web Analytics -->`;

/* Rebond du logo au clic dans le header, identique à celui de index.html (--app-logo).
   Ajouté le 30 août 2026 avec le thème Santé Québec — présent sur toutes les pages générées. */
const BRAND_TAP_SCRIPT = `<script>
document.querySelectorAll('.brand').forEach(function (b) {
  b.addEventListener('click', function () {
    b.classList.remove('tapped');
    void b.offsetWidth;
    b.classList.add('tapped');
  });
});
</script>`;

/* Migration v52 : l'ancienne application générale enregistrait un service worker de portée
   « / ». La PWA étant désormais réservée à Montérégie-Est, toutes les pages de contenu retirent
   cette ancienne inscription si elle existe. La PWA Est, de portée /monteregie-est/, est
   conservée. */
const SERVICE_WORKER_CLEANUP = `<script>
if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
  navigator.serviceWorker.getRegistrations().then(function (registrations) {
    registrations.forEach(function (registration) {
      try {
        if (new URL(registration.scope).pathname === '/') registration.unregister();
      } catch (e) {}
    });
  }).catch(function () {});
}
</script>`;

/*
 * Badge « Vérifié » — bascule l'infobulle au toucher/clic. Le survol et le focus clavier sont
 * déjà gérés en CSS pure (voir assets/seo-pages.css) ; seul le toucher a besoin de JS, un simple
 * :focus ne se déclenchant pas de façon fiable au tap sur mobile. Ajouté le 26 août 2026, aucune
 * dépendance externe. N'apparaît dans la page que si elle contient au moins un badge (voir
 * l'usage de cette constante dans page() plus bas).
 */
const BADGE_VERIF_SCRIPT = `<script>
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.badge-verif');document.querySelectorAll('.badge-verif.show').forEach(function(x){if(x!==b)x.classList.remove('show')});if(b){e.stopPropagation();b.classList.toggle('show')}});
document.addEventListener('keydown',function(e){if(e.key==='Escape')document.querySelectorAll('.badge-verif.show').forEach(function(b){b.classList.remove('show')})});
</script>`;

/* ------------------------------------------------------------------------------------------- */
/* RÉGLAGES                                                                                     */
/* ------------------------------------------------------------------------------------------- */

/*
 * Publier ou non les courriels de recrutement sur les pages indexables et la carte.
 * Décision du 2 septembre 2026 : OUI. Les adresses fournies pour le recrutement sont
 * affichées sur les fiches (carte et pages SEO), conformément au formulaire public.
 */
const PUBLIER_COURRIELS = true;

/*
 * Seuil de contenu à partir duquel une page de clinique est jugée assez substantielle pour être
 * proposée à l'indexation. En dessous, la page existe quand même (elle sert au visiteur) mais
 * porte "noindex" et reste hors du sitemap.
 *
 * Pourquoi : au 19 août 2026, 23 fiches sur 61 n'ont que 2 à 4 champs remplis (pas d'horaire, pas
 * d'équipe). 23 pages quasi vides publiées d'un coup, c'est le motif que Google appelle « contenu
 * mince produit à grande échelle » — le risque n'est pas seulement que ces pages ne classent pas,
 * c'est qu'elles tirent le domaine entier vers le bas.
 *
 * Ce seuil est AUTOMATIQUE : dès qu'une fiche se remplit dans data.json et repasse au-dessus, la
 * prochaine génération la bascule en indexable toute seule. Rien à surveiller à la main.
 */
const SEUIL_INDEXATION = 5;

/* Champs comptés pour évaluer la substance d'une fiche (voir SEUIL_INDEXATION). */
const CHAMPS_SUBSTANCE = [
  'adresse', 'horaire', 'personnel', 'dme', 'pratiques', 'niveau',
  'frais', 'bureau', 'site', 'presentation', 'infos', 'gardeUrgence', 'gardeAutre'
];

/*
 * LISTE BLANCHE des champs de data.json autorisés à sortir sur le site public.
 * Tout ce qui n'est pas ici n'est jamais rendu. Volontairement absents :
 *   notes            → notes personnelles des usagers, ne doivent jamais fuir
 *   alias            → mots-clés de recherche interne, pas du contenu
 *   lat / lng        → utiles à la carte, inutiles au lecteur ; restent dans data.json
 *   posApprox        → indicateur technique de précision du géocodage
 *   visible          → drapeau de publication, pas du contenu
 *   recrutementActif → drapeau de statut (même nature que « visible »), voir recrute() plus
 *                      bas ; sert à choisir entre deux textes tout faits, jamais affiché tel quel
 *   statutRecrutement→ texte libre du brouillon d'origine, non repris ; recrute() + un texte fixe
 *                      (« Ne recrute pas actuellement ») suffisent et restent cohérents avec
 *                      l'application (voir index.html)
 */
const CHAMPS_PUBLICS = [
  'id', 'nom', 'ville', 'adresse', 'type', 'region', 'rls', 'niveau', 'niveaux',
  'dme', 'pratiques', 'bureau', 'frais', 'horaire', 'personnel', 'site',
  'porteOuverte', 'presentation', 'infos', 'gardeUrgence', 'gardeAutre',
  /* validation → ajouté le 26 août 2026. N'est PAS affiché comme ligne de fiche ; sert
     uniquement à décider si le badge « Vérifié » apparaît et à afficher sa date (voir
     estValide()/badgeVerif() plus bas). Le sous-champ "source" n'est jamais publié. */
  'validation',
  /* responsableNom → nom du médecin responsable du recrutement. */
  'responsableNom',
  /* personneRessource → courriel(s) de recrutement, publiés depuis le 2 sept. 2026. */
  'personneRessource'
];

/*
 * Un milieu « ne recrute pas actuellement » (recrutementActif === false, 27 août 2026 — 43
 * fiches importées du brouillon Montérégie-Est) reste publié : sa page, sa présence
 * dans le répertoire et dans sa page de RLS suivent exactement les mêmes règles qu'un milieu en
 * recrutement (seuil de substance, liste blanche, etc.). Seul le TEXTE change à quelques
 * endroits précis, pour ne jamais affirmer qu'un milieu recrute quand ce n'est pas le cas — voir
 * chaque usage de recrute() ci-dessous.
 */
function recrute(c) { return c.recrutementActif !== false; }

/* Libellés lisibles des codes de pratique (mêmes libellés que la légende de la carte). */
const PRATIQUES = {
  pec:  'Prise en charge',
  gap:  "Guichet d'accès à la première ligne",
  sad:  'Soins à domicile',
  peri: 'Périnatalité',
  msk:  'Médecine sportive',
  chir: 'Chirurgie mineure'
};

/* Libellés lisibles des catégories de personnel. */
const PERSONNEL = {
  medecins: 'Médecins',
  residents: 'Résidents',
  ipspl: 'IPSPL',
  infirmieres: 'Infirmières',
  infauxiliaires: 'Infirmières auxiliaires',
  pharmaciennes: 'Pharmaciennes',
  nutritionnistes: 'Nutritionnistes',
  physiotherapeutes: 'Physiothérapeutes',
  psychologues: 'Psychologues',
  travailleuresSociales: 'Travailleuses sociales',
  intervenantspsychosociaux: 'Intervenants psychosociaux',
  specialistes: 'Spécialistes'
};

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const JOURS_SCHEMA = {
  Lundi: 'Monday', Mardi: 'Tuesday', Mercredi: 'Wednesday', Jeudi: 'Thursday',
  Vendredi: 'Friday', Samedi: 'Saturday', Dimanche: 'Sunday'
};

/* ------------------------------------------------------------------------------------------- */
/* OUTILS                                                                                       */
/* ------------------------------------------------------------------------------------------- */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rempli(v) {
  if (v == null) return false;
  if (typeof v === 'string') {
    const t = v.trim();
    return t !== '' && !['à compléter', 'a completer', 'tbd', 'n/a'].includes(t.toLowerCase());
  }
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v).some(rempli);
  return true;
}

/* Rend chaque adresse courriel de recrutement cliquable (séparateurs : virgule, ;, espace). */
function lienCourrielRecrutement(valeur) {
  const texte = String(valeur || '').trim();
  if (!texte) return '';
  const reMail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const parts = texte.split(/[,;]+|\s+/).map(p => p.trim()).filter(Boolean);
  if (parts.length && parts.every(p => reMail.test(p))) {
    return parts.map(p => `<a href="mailto:${esc(p)}">${esc(p)}</a>`).join(', ');
  }
  return esc(texte);
}

/* Bouton mailto pour l'encadré d'appel à l'action — sans afficher l'adresse en clair. */
function boutonCourrielRecrutement(valeur) {
  const texte = String(valeur || '').trim();
  if (!texte) return '';
  const reMail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const parts = texte.split(/[,;]+|\s+/).map(p => p.trim()).filter(Boolean);
  if (parts.length && parts.every(p => reMail.test(p))) {
    const href = 'mailto:' + parts.join(',');
    return `<a class="button secondary" href="${esc(href)}">Contacter par courriel</a>`;
  }
  return esc(texte);
}

/*
 * Badge « Vérifié » — voir aussi index.html (.badge-verif / estValide / badgeVerifHtml, ajoutés
 * le 26 août 2026 pour l'application). Même logique côté pages statiques : le badge n'apparaît
 * QUE si validation.statut === 'valide' (révision manuelle terminée), jamais sur une simple
 * réponse reçue au formulaire. Champ ajouté volontairement à CHAMPS_PUBLICS ci-dessus — voir la
 * liste blanche — mais UNIQUEMENT pour décider d'afficher ce badge et sa date ; le contenu brut
 * de "validation" n'est jamais affiché comme ligne de la fiche (pas de source/statut visibles).
 */
const MOIS_FR_SEO = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function dateLisibleFr(iso) {
  const m = typeof iso === 'string' && iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const mois = MOIS_FR_SEO[parseInt(m[2], 10) - 1];
  return mois ? `${parseInt(m[3], 10)} ${mois} ${m[1]}` : '';
}
function estValide(c) { return !!(c && c.validation && c.validation.statut === 'valide'); }
const SVG_BADGE_VERIF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>';
function badgeVerif(c) {
  if (!estValide(c)) return '';
  const date = dateLisibleFr(c.validation.date);
  const msg = 'Informations confirmées par la clinique via le formulaire.'
    + (date ? ' Dernière validation : ' + date + '.' : '');
  return `<button type="button" class="badge-verif" title="${esc(msg)}" aria-label="${esc(msg)}"><span class="badge-verif-tip" aria-hidden="true">${esc(msg)}</span>${SVG_BADGE_VERIF}</button>`;
}

/* Slug lisible et stable : minuscules, sans accent, tirets. Le contenu entre parenthèses est
   CONSERVÉ — c'est parfois la seule chose qui distingue deux fiches (« GMF Saint-Constant
   (Monchamp) » et « GMF Saint-Constant (de la gare) »). */
function slugifier(nom) {
  return String(nom)
    /* Les ligatures "oe"/"ae" (27 aout 2026) ne sont pas des lettres accentuees : NFD ne les
       decompose pas, elles survivraient donc telles quelles jusqu'au filtre [^a-z0-9] suivant et
       tomberaient comme un tiret ("Coeur" -> "c-ur"). Repris de la meme normalisation que
       normTxt() dans index.html (recherche), pour que "coeur" reste lisible dans l'URL plutot
       qu'un tiret au milieu du mot. */
    .replace(/\u0153/g, 'oe').replace(/\u0152/g, 'Oe').replace(/\u00e6/g, 'ae').replace(/\u00c6/g, 'Ae')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80).replace(/-+$/, '');
}

/*
 * Anciennes URL créées avant la prise en charge des ligatures « œ ». Elles ont déjà été publiées
 * et peuvent donc exister dans des favoris ou dans l'index d'un moteur de recherche : on ne les
 * supprime pas, on les transforme en redirections permanentes côté contenu vers le slug corrigé.
 */
const REDIRECTIONS_SLUGS_HISTORIQUES = [
  {
    ancien: 'cabinet-medical-au-c-ur-des-vergers',
    nouveau: 'cabinet-medical-au-coeur-des-vergers',
    libelle: 'La fiche du Cabinet Médical au Cœur des Vergers'
  },
  {
    ancien: 'cmi-contrec-ur',
    nouveau: 'cmi-contrecoeur',
    libelle: 'La fiche du CMI Contrecœur'
  },
  {
    ancien: 'gmf-contrec-ur-cooperative-sante-contrec-ur',
    nouveau: 'gmf-contrecoeur-cooperative-sante-contrecoeur',
    libelle: 'La fiche du GMF Contrecœur (Coopérative Santé Contrecœur)'
  },
  /* 29 août 2026 : suppression du doublon technique id 89. L'ancienne URL est conservée comme
     redirection vers le GMF Richelieu canonique, au 500, route Marie-Victorin, bureau 200.
     La clinique distincte du 300, rue Paradis demeure publiée sous sa propre fiche (id 86). */
  {
    ancien: 'gmf-richelieu-clinique-de-medecine-familiale',
    nouveau: 'gmf-richelieu',
    libelle: 'La fiche du GMF Richelieu'
  }
];

/*
 * Slugs STABLES. Une URL déjà indexée par Google ne doit pas changer parce qu'on a corrigé une
 * faute dans le nom d'une clinique. On garde donc une correspondance id → slug dans
 * scripts/slugs.json : une fois qu'un identifiant a reçu son slug, il le garde pour toujours.
 * Seules les fiches nouvelles reçoivent un slug calculé.
 */
function chargerSlugs(fichier) {
  try { return JSON.parse(fs.readFileSync(fichier, 'utf8')); }
  catch (e) { return {}; }
}

function attribuerSlugs(cliniques, memoire) {
  const pris = new Set(Object.values(memoire));
  const nouveaux = [];
  for (const c of cliniques) {
    const cle = String(c.id);
    if (memoire[cle]) continue;             // déjà attribué : on n'y touche jamais
    let base = slugifier(c.nom) || ('clinique-' + cle);
    let slug = base, n = 2;
    while (pris.has(slug)) { slug = base + '-' + n; n++; }
    memoire[cle] = slug;
    pris.add(slug);
    nouveaux.push({ id: cle, nom: c.nom, slug });
  }
  return nouveaux;
}

/* Découpe l'adresse pour schema.org sans jamais inventer. Le code postal n'est extrait que s'il
   correspond exactement au format canadien ; la ville vient du champ « ville », pas d'une
   supposition sur la chaîne. Si on ne sait pas découper, on omet le morceau. */
function decouperAdresse(adresse, ville) {
  const out = { addressLocality: ville || undefined, addressRegion: 'QC', addressCountry: 'CA' };
  if (!rempli(adresse)) return out;
  let reste = String(adresse).trim();
  const cp = reste.match(/\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/);
  if (cp) { out.postalCode = cp[1]; reste = reste.replace(cp[0], ''); }
  reste = reste.replace(/\bQC\b|\bQu[ée]bec\b/gi, '');
  if (ville) reste = reste.replace(new RegExp('\\b' + ville.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), '');
  reste = reste.replace(/[,\s]+$/g, '').replace(/^[,\s]+/g, '').replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',');
  if (reste) out.streetAddress = reste;
  return out;
}

/* « 8h00 – 20h00 » → { opens:'08:00', closes:'20:00' }. Gère les journées coupées
   (« 8h30 – 11h45 / 13h00 – 16h30 » → deux plages). Tout ce qui n'est pas une plage horaire
   claire (« Fermé », « Urgence sur RDV seulement ») ne produit RIEN plutôt qu'une approximation. */
function analyserPlages(texte) {
  const plages = [];
  for (const morceau of String(texte).split('/')) {
    const m = morceau.match(/(\d{1,2})\s*h\s*(\d{2})?\s*[–\-—]\s*(\d{1,2})\s*h\s*(\d{2})?/);
    if (!m) continue;
    const p = (h, min) => String(h).padStart(2, '0') + ':' + (min || '00');
    plages.push({ opens: p(m[1], m[2]), closes: p(m[3], m[4]) });
  }
  return plages;
}

/* ------------------------------------------------------------------------------------------- */
/* GABARIT COMMUN                                                                               */
/* ------------------------------------------------------------------------------------------- */

/* ------------------------------------------------------------------------------------------- */
/* LES DEUX UNIVERS DU SITE                                                                     */
/* ------------------------------------------------------------------------------------------- */

/*
 * Depuis le 21 août 2026, le générateur produit DEUX jeux de pages à partir des mêmes données :
 *
 *   UNIVERS_GENERAL  — /cliniques/…, /rls/… : le site tel qu'il existait, les trois territoires.
 *   UNIVERS_REGIONS  — /monteregie-est/…,
 *                      /monteregie-centre/…,
 *                      /monteregie-ouest/…    : un univers COMPLÈTEMENT ÉTANCHE par territoire.
 *                                               Né pour la seule Montérégie-Est le 21 août 2026,
 *                                               étendu aux trois territoires le 26 août.
 *
 * Pourquoi un univers séparé plutôt qu'un simple filtre : choix du 21 août, en
 * réponse au besoin exprimé par le CISSS Montérégie-Est. Une personne qui entre par
 * /monteregie-est/ ne doit JAMAIS croiser un lien vers la carte des trois territoires, vers le
 * répertoire /cliniques/ (qui mélange les territoires) ni vers un RLS d'un autre CISSS — ni dans
 * l'en-tête, ni dans le fil d'Ariane, ni dans un bouton, ni dans « pour aller plus loin ». Les
 * pages de l'univers Est n'ont donc pas les mêmes liens : c'est la seule différence entre les
 * deux versions d'une même fiche, le contenu lui-même est identique.
 *
 * Le prix à payer, c'est du contenu quasi identique à deux adresses. Il est réglé plus bas par
 * les règles d'indexation (voir seoDe()) : pour un contenu propre à l'Est, c'est la page
 * /monteregie-est/ qui est l'officielle et la page générale qui s'efface; jamais les deux.
 */
const EST_PREFIXE = '/monteregie-est';
const EST_ACCUEIL = EST_PREFIXE + '/';

const BANNIERE_EST_LARGEUR = '1024';
const BANNIERE_EST_HAUTEUR = '341';
const BANNIERE_EST_FICHIER = 'banniere_monteregie-est.jpg';

const UNIVERS_GENERAL = {
  regional: false,
  region: null,
  nom: 'Montérégie-Est',
  prefixe: '',
  accueil: EST_ACCUEIL,
  dossier: '',
  canonique: true,
  banniere: { fichier: BANNIERE_EST_FICHIER, largeur: BANNIERE_EST_LARGEUR, hauteur: BANNIERE_EST_HAUTEUR }
};

/*
 * CANONIQUE — laquelle des deux adresses d'un même contenu est l'officielle pour Google.
 *
 * Les trois territoires sont désormais basculés (Est le 21 août, Ouest et Centre le
 * 30 août 2026, à la demande d'Olivier) : pour chacun, c'est la page RÉGIONALE qui est
 * l'officielle (voir pageClinique plus bas). La page générale reste en ligne pour ne casser
 * aucun lien externe déjà indexé, mais devient une redirection physique vers la version
 * régionale plutôt qu'un doublon complet.
 *
 * Pour revenir en arrière sur un territoire, passer `canonique` à false ci-dessous :
 * l'indexation, les canoniques, le sitemap et le choix page-complète/redirection suivent tous
 * seuls, aucune autre modification n'est nécessaire.
 */
/* ordreRls — l'ordre dans lequel les RLS d'un territoire sont présentés sur son hub /rls/.
   C'est EXACTEMENT celui de RLS_COLORS_PAR_REGION dans index.html, donc celui de la légende de
   la carte : la carte, la liste latérale et cette page racontent la même histoire dans le même
   ordre. Un RLS absent de cette liste (nouveau territoire, renommage) passerait à la fin plutôt
   que de disparaître — voir rangRls(). */
const UNIVERS_REGIONS = [
  { region: 'Est',    nom: 'Montérégie-Est',    dossier: 'monteregie-est',    canonique: true,
    ordreRls: ['Pierre-Boucher', 'Richelieu-Yamaska', 'Pierre-De Saurel'],
    banniere: { fichier: BANNIERE_EST_FICHIER, largeur: BANNIERE_EST_LARGEUR, hauteur: BANNIERE_EST_HAUTEUR } },
  { region: 'Centre', nom: 'Montérégie-Centre', dossier: 'monteregie-centre', canonique: true,
    ordreRls: ['Champlain', 'Haut-Richelieu–Rouville'],
    banniere: null },
  { region: 'Ouest',  nom: 'Montérégie-Ouest',  dossier: 'monteregie-ouest',  canonique: true,
    ordreRls: ['Jardins-Roussillon', 'Vaudreuil-Soulanges', 'du Suroît', 'du Haut-Saint-Laurent'],
    banniere: null }
].map(u => Object.assign({
  regional: true,
  prefixe: '/' + u.dossier,
  accueil: '/' + u.dossier + '/'
}, u));

/* Accès par territoire : UNIVERS_PAR_REGION['Est'] → l'univers de la Montérégie-Est. */
const UNIVERS_PAR_REGION = Object.fromEntries(UNIVERS_REGIONS.map(u => [u.region, u]));

/* Navigation identique sur toutes les pages SEO : la marque renvoie toujours à l'accueil. */
const LIENS_NAV = [
  ['/', 'Accueil', 'accueil'],
  [EST_ACCUEIL, 'Carte interactive', 'carte'],
  [EST_PREFIXE + '/cliniques/', 'Cliniques', 'cliniques'],
  [EST_PREFIXE + '/etablissements/', 'Établissements', 'etablissements'],
  [EST_PREFIXE + '/ptem/', 'PTEM', 'ptem'],
  [EST_PREFIXE + '/amp/', 'AMP', 'amp']
];

function htmlBanniereSqb(assetsChemin, { compact = true } = {}) {
  const wrap = compact ? 'sqb-wrap compact directory-banner' : 'sqb-wrap';
  const img = `${assetsChemin}/${BANNIERE_EST_FICHIER}`;
  return `<figure class="${wrap}"><a class="sqb-photo" href="${EST_ACCUEIL}" aria-label="Ouvrir la carte interactive Montérégie-Est"><img src="${img}" srcset="${img} ${BANNIERE_EST_LARGEUR}w" sizes="(max-width: ${BANNIERE_EST_LARGEUR}px) 100vw, ${BANNIERE_EST_LARGEUR}px" alt="Carte interactive Trouve ta clinique — Montérégie-Est" width="${BANNIERE_EST_LARGEUR}" height="${BANNIERE_EST_HAUTEUR}" decoding="sync" loading="lazy"></a></figure>`;
}

function page({ titre, description, url, profondeur, indexable = true, canonical, jsonLd,
                filDAriane, corps, actif, univers = UNIVERS_GENERAL, ogImageOverride = null }) {
  const u = univers;
  /* Feuille de style : chemin relatif dans l'univers général (comme avant), absolu dans
     l'univers Est, dont les pages ne vivent pas toutes à la même profondeur. */
  const cssHref = u.regional ? '/assets/seo-pages.css'
                        : profondeur === 0 ? '/assets/seo-pages.css'
                        : (profondeur === 1 ? '../' : '../../') + 'assets/seo-pages.css';
  const robots = indexable
    ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
    : 'noindex,follow';
  // Aperçu de partage (og:image) : la bannière Montérégie-Est dans l'univers Est, pour qu'un
  // lien partagé (courriel, réseaux sociaux…) affiche la bonne image — pas celle de la
  // carte générale des 3 territoires (22 août : bannière officielle appliquée de façon
  // cohérente partout).
  const ogImage = ogImageOverride
    ? `${SITE}/assets/${ogImageOverride.fichier}`
    : (u.banniere ? `${SITE}/assets/${u.banniere.fichier}` : `${SITE}/og-image.png?v=2`);
  const ogImageW = ogImageOverride ? ogImageOverride.largeur : (u.banniere ? u.banniere.largeur : '1200');
  const ogImageH = ogImageOverride ? ogImageOverride.hauteur : (u.banniere ? u.banniere.hauteur : '630');
  const ogImageAlt = ogImageOverride ? ogImageOverride.alt
    : (u.regional
      ? `Carte interactive ${u.nom} — Trouve ta clinique.`
      : 'Carte interactive Montérégie-Est — Trouve ta clinique.');
  /* Navigation unifiée : même libellés et mêmes cibles sur toutes les pages SEO. */
  const liens = LIENS_NAV;
  const nav = liens.map(([href, txt, cle]) =>
    `      <a href="${href}"${actif === cle ? ' aria-current="page"' : ''}>${txt}</a>`).join('\n');

  return `<!doctype html>
<html lang="fr-CA">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titre)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical || url)}">
  <meta name="robots" content="${robots}">
  <meta name="google-site-verification" content="-8EkDVTZKsywxr7fJMd3kZIMVaUedo7eU9ThFutr8dY" />
  <meta property="og:locale" content="fr_CA">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Trouve ta clinique">
  <meta property="og:title" content="${esc(titre)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="${ogImageW}">
  <meta property="og:image:height" content="${ogImageH}">
  <meta property="og:image:alt" content="${esc(ogImageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(titre)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${ogImage}">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
  <link rel="stylesheet" href="${cssHref}">
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2).split('\n').map(l => '  ' + l).join('\n')}
  </script>
</head>
<body>
<a class="skip-link" href="#contenu">Aller au contenu</a>
<header class="site-header">
  <div class="site-header__inner">
    <a class="brand" href="/">
      <span class="logo-img" role="img" aria-label="Logo Trouve ta clinique"></span>
      <span class="brand-name">Trouve ta clinique</span>
    </a>
    <nav class="nav" aria-label="Navigation principale">
${nav}
    </nav>
  </div>
</header>
<main id="contenu">
  <nav class="breadcrumbs" aria-label="Fil d’Ariane">${filDAriane}</nav>
${corps}
</main>
<footer class="site-footer"><div class="site-footer__inner">Trouve ta clinique est un outil d’information et de comparaison, indépendant du gouvernement du Québec et des DTMF. Les fiches regroupent les données du répertoire, des sources publiques et, lorsqu’elles sont disponibles, des informations communiquées par les milieux. Ces renseignements peuvent changer; pour toute décision officielle, validez l’information auprès du milieu, du DTMF ou des sources gouvernementales compétentes.<div class="site-footer__copyright">© ${new Date().getFullYear()} Olivier Laplante — Trouve ta clinique</div></div></footer>
${corps.includes('badge-verif') ? BADGE_VERIF_SCRIPT + '\n' : ''}${BRAND_TAP_SCRIPT}
${SERVICE_WORKER_CLEANUP}
${CLOUDFLARE_ANALYTICS}
</body>
</html>
`;
}

/* ------------------------------------------------------------------------------------------- */
/* PAGE D'UNE CLINIQUE                                                                          */
/* ------------------------------------------------------------------------------------------- */

function pageClinique(c, slug, majDonnees, u = UNIVERS_GENERAL) {
  const urlGeneral = `${SITE}/cliniques/${slug}/`;
  const uRegion = UNIVERS_PAR_REGION[c.region];
  const urlRegional = uRegion ? `${SITE}${uRegion.prefixe}/cliniques/${slug}/` : urlGeneral;
  const url = u.regional ? `${SITE}${u.prefixe}/cliniques/${slug}/` : urlGeneral;
  const substance = CHAMPS_SUBSTANCE.filter(k => rempli(c[k])).length;
  const assezRemplie = substance >= SEUIL_INDEXATION;
  const enRecrutement = recrute(c);

  /* BASCULE SEO (21 août 2026 ; généralisée le 26 août). Une clinique dont
     le territoire a sa propre carte a DEUX pages : la page générale et la page régionale. Pour
     que Google n'ait jamais à choisir entre deux adresses au contenu identique, une seule des
     deux est officielle. Laquelle, c'est le champ `canonique` de l'univers du territoire qui le
     dit (voir UNIVERS_REGIONS) : la page régionale pour la Montérégie-Est, la page générale
     pour le Centre et l'Ouest. L'autre reste en ligne — aucun lien cassé — mais en noindex, et
     désigne l'officielle comme version de référence, ce qui lui transmet la valeur déjà acquise
     plutôt que de la perdre. */
  const canonical = (uRegion && uRegion.canonique) ? urlRegional : urlGeneral;
  const indexable = assezRemplie && url === canonical;
  const lienPrefixe = u.regional ? u.prefixe : EST_PREFIXE;

  /* --- Renseignements, champ par champ, uniquement depuis la liste blanche --- */
  const lignes = [];
  const ajouter = (etiquette, valeur) => {
    if (rempli(valeur)) lignes.push(`      <dt>${esc(etiquette)}</dt><dd>${valeur}</dd>`);
  };

  ajouter('Type de milieu', esc(c.type));
  ajouter('Ville', esc(c.ville));
  ajouter('Adresse', esc(c.adresse));
  ajouter('Territoire', rempli(c.region) ? esc('Montérégie-' + c.region) : '');
  ajouter('Réseau local de services (RLS)', rempli(c.rls)
    ? `<a href="${u.prefixe}/rls/${slugifier(c.rls)}/">${esc(c.rls)}</a>` : '');
  ajouter('Niveau', esc(c.niveau));
  ajouter('Dossier médical électronique (DMÉ)', esc(c.dme));

  if (Array.isArray(c.pratiques) && c.pratiques.length) {
    ajouter('Pratiques offertes',
      esc(c.pratiques.map(p => PRATIQUES[p] || p).join(', ')));
  }
  ajouter('Bureau', esc(c.bureau));
  ajouter('Frais de bureau', esc(c.frais));
  ajouter('Garde à l’urgence', esc(c.gardeUrgence));
  ajouter('Autres gardes', esc(c.gardeAutre));
  ajouter('Porte ouverte', esc(c.porteOuverte));
  ajouter('Site web', rempli(c.site)
    ? `<a href="${esc(c.site)}" rel="noopener nofollow" target="_blank">${esc(c.site)}</a>` : '');
  if (rempli(c.responsableNom)) {
    ajouter('Responsable', esc(c.responsableNom));
  }
  if (PUBLIER_COURRIELS && rempli(c.personneRessource)) {
    ajouter('Contact recrutement', lienCourrielRecrutement(c.personneRessource));
  }

  /* --- Horaires --- */
  let blocHoraire = '';
  if (rempli(c.horaire)) {
    const rangs = JOURS.filter(j => rempli(c.horaire[j]))
      .map(j => `        <tr><th scope="row">${j}</th><td>${esc(c.horaire[j])}</td></tr>`).join('\n');
    if (rangs) {
      blocHoraire = `
  <section id="horaire">
    <h2>Heures d’ouverture</h2>
    <table class="horaire">
      <tbody>
${rangs}
      </tbody>
    </table>
  </section>`;
    }
  }

  /* --- Équipe --- */
  let blocEquipe = '';
  if (rempli(c.personnel)) {
    const items = Object.keys(PERSONNEL).filter(k => rempli(c.personnel[k]))
      .map(k => `      <li><span class="eq-n">${esc(c.personnel[k])}</span> ${esc(PERSONNEL[k])}</li>`).join('\n');
    if (items) {
      blocEquipe = `
  <section id="equipe">
    <h2>Équipe sur place</h2>
    <ul class="equipe">
${items}
    </ul>
    <p class="note">Composition indiquée dans le répertoire; à confirmer auprès du milieu, puisqu’elle peut évoluer.</p>
  </section>`;
    }
  }

  /* --- Texte libre du milieu (vide pour l'instant dans data.json, apparaîtra tout seul) --- */
  let blocTexte = '';
  if (rempli(c.presentation) || rempli(c.infos)) {
    blocTexte = `
  <section id="presentation">
    <h2>Présentation du milieu</h2>
${rempli(c.presentation) ? '    <p>' + esc(c.presentation) + '</p>' : ''}
${rempli(c.infos) ? '    <p>' + esc(c.infos) + '</p>' : ''}
  </section>`;
  }

  /* --- Données structurées : uniquement ce qu'on sait réellement --- */
  const clinique = {
    '@type': 'MedicalClinic',
    '@id': url + '#clinique',
    name: c.nom,
    url: url,
    address: Object.assign({ '@type': 'PostalAddress' }, decouperAdresse(c.adresse, c.ville))
  };
  if (rempli(c.site)) clinique.sameAs = [c.site];
  if (typeof c.lat === 'number' && typeof c.lng === 'number') {
    clinique.geo = { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lng };
  }
  if (rempli(c.horaire)) {
    const specs = [];
    for (const j of JOURS) {
      for (const p of analyserPlages(c.horaire[j] || '')) {
        specs.push({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: 'https://schema.org/' + JOURS_SCHEMA[j],
          opens: p.opens, closes: p.closes
        });
      }
    }
    if (specs.length) clinique.openingHoursSpecification = specs;
  }
  /* Contact de recrutement : nom et, si publié, courriel(s). */
  if (rempli(c.responsableNom) || (PUBLIER_COURRIELS && rempli(c.personneRessource))) {
    const point = {
      '@type': 'ContactPoint',
      contactType: 'recrutement médical'
    };
    if (rempli(c.responsableNom)) point.name = c.responsableNom;
    if (PUBLIER_COURRIELS && rempli(c.personneRessource)) {
      const premier = String(c.personneRessource).split(/[,;]+|\s+/).map(s => s.trim()).find(Boolean);
      if (premier && premier.includes('@')) point.email = premier;
    }
    clinique.contactPoint = [point];
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': url + '#webpage',
        url: url,
        name: enRecrutement
          ? `${c.nom} — clinique en recrutement en Montérégie | Trouve ta clinique`
          : `${c.nom} — clinique de la Montérégie | Trouve ta clinique`,
        inLanguage: 'fr-CA',
        dateModified: majDonnees,
        isPartOf: { '@id': SITE + '/#website' },
        about: { '@id': url + '#clinique' }
      },
      clinique,
      {
        '@type': 'BreadcrumbList',
        itemListElement: u.regional
          ? [
            { '@type': 'ListItem', position: 1, name: u.nom, item: SITE + u.accueil },
            { '@type': 'ListItem', position: 2, name: 'RLS ' + c.rls, item: `${SITE}${u.prefixe}/rls/${slugifier(c.rls || '')}/` },
            { '@type': 'ListItem', position: 3, name: c.nom, item: url }
          ]
          : [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
            { '@type': 'ListItem', position: 2, name: 'Cliniques', item: SITE + '/cliniques/' },
            { '@type': 'ListItem', position: 3, name: c.nom, item: url }
          ]
      }
    ]
  };

  /* 27 août 2026 / 2 sept. 2026 : hors recrutement → mention de statut.
     En recrutement avec PUBLIER_COURRIELS : le courriel apparaît déjà dans la fiche.
     Sinon, renvoyer vers la carte. */
  const contact = !enRecrutement
    ? `
  <div class="callout"><strong>Ne recrute pas actuellement :</strong> ce milieu est publié à titre de référence dans le répertoire. Consultez la carte interactive pour connaître les milieux du secteur qui recrutent actuellement.</div>`
    : (PUBLIER_COURRIELS && rempli(c.personneRessource))
    ? `
  <div class="callout"><strong>Pour joindre ce milieu au sujet du recrutement :</strong> ${boutonCourrielRecrutement(c.personneRessource)}</div>`
    : PUBLIER_COURRIELS
    ? ''
    : `
  <div class="callout"><strong>Pour joindre ce milieu au sujet du recrutement :</strong> les coordonnées de la personne-ressource sont affichées dans la fiche de la clinique sur la carte interactive. <a href="${u.accueil}?c=${c.id}">Ouvrir la fiche de ${esc(c.nom)} sur la carte →</a></div>`;

  const corps = `  <section class="hero">
    <p class="eyebrow">${esc(c.type)}${rempli(c.rls) ? ' · RLS ' + esc(c.rls) : ''}${enRecrutement ? '' : ' · Ne recrute pas actuellement'}</p>
    <h1>${esc(c.nom)}${badgeVerif(c)}</h1>
    <p class="lead">${enRecrutement
      ? `${esc(c.nom)} — ${esc(c.type)} situé à ${esc(c.ville)}, en Montérégie — recrute des médecins de famille. Cette page rassemble les renseignements actuellement publiés dans le répertoire pour aider à évaluer le milieu avant de le contacter.`
      : `${esc(c.nom)} — ${esc(c.type)} situé à ${esc(c.ville)}, en Montérégie. Ce milieu ne recrute pas de médecin de famille actuellement; cette page rassemble les renseignements publiés dans le répertoire à titre de référence.`}</p>
    <p class="updated"><strong>Données mises à jour le :</strong> ${esc(majDonnees)}.</p>
    <div class="cta-row">
      <a class="button primary" href="${u.accueil}?c=${c.id}">Voir sur la carte interactive</a>
      ${u.regional
        ? `<a class="button secondary" href="${u.prefixe}/rls/${slugifier(c.rls || '')}/">Autres cliniques du RLS ${esc(c.rls)}</a>`
        : `<a class="button secondary" href="${EST_PREFIXE}/cliniques/">Toutes les cliniques</a>`}
    </div>
  </section>
${contact}
  <section id="renseignements">
    <h2>Renseignements</h2>
    <dl class="fiche">
${lignes.join('\n')}
    </dl>
  </section>${blocHoraire}${blocEquipe}${blocTexte}
  <div class="data-note"><strong>Source et vérification :</strong> cette fiche reproduit les données actuellement consignées dans le répertoire (date de mise à jour affichée ci-dessus). Certains champs peuvent provenir de sources publiques ou d’informations communiquées par le milieu. Lorsqu’un site officiel est disponible, il est lié dans la section « Renseignements ». Les éléments susceptibles d’évoluer — DMÉ, équipe, frais, horaires et pratiques offertes — doivent être confirmés auprès du milieu; pour le PTEM et les AMP, les sources officielles et le DTMF priment.</div>

  <section id="suite">
    <h2>Pour aller plus loin</h2>
    <ul class="source-list">
      <li><a href="${lienPrefixe}/rls/${slugifier(c.rls || '')}/">Autres milieux du RLS ${esc(c.rls)}</a></li>
      <li><a href="${lienPrefixe}/ptem/">Comprendre le PTEM et l’avis de conformité</a></li>
      <li><a href="${lienPrefixe}/amp/">Comprendre les activités médicales particulières (AMP)</a></li>
      <li><a href="${u.accueil}?c=${c.id}">Fiche complète et itinéraire sur la carte interactive</a></li>
    </ul>
  </section>`;

  return {
    html: page({
      titre: `${c.nom} — ${c.ville} | Trouve ta clinique`,
      description: enRecrutement
        ? `${c.nom}, ${c.type} de ${c.ville} (RLS ${c.rls}) en recrutement de médecins de famille en Montérégie : type de milieu, pratiques offertes${rempli(c.dme) ? ', DMÉ' : ''}${rempli(c.horaire) ? ', heures d’ouverture' : ''}.`
        : `${c.nom}, ${c.type} de ${c.ville} (RLS ${c.rls}) en Montérégie — ne recrute pas de médecin de famille actuellement : type de milieu, coordonnées et heures d’ouverture publiées à titre de référence.`,
      url, canonical, profondeur: 2, indexable, jsonLd, univers: u,
      actif: u.regional ? null : 'cliniques',
      filDAriane: u.regional
        ? `<a href="${u.accueil}">${esc(u.nom)}</a> › <a href="${u.prefixe}/rls/${slugifier(c.rls || '')}/">RLS ${esc(c.rls)}</a> › ${esc(c.nom)}`
        : `<a href="/">Accueil</a> › <a href="${EST_PREFIXE}/cliniques/">Cliniques</a> › ${esc(c.nom)}`,
      corps
    }),
    indexable, substance
  };
}

/* ------------------------------------------------------------------------------------------- */
/* PAGE D'UN RLS                                                                                */
/* ------------------------------------------------------------------------------------------- */

/*
 * Les 3 RLS de la Montérégie-Est. Choix du 21 août 2026, affiné le même jour après
 * une suggestion reçue : sur CES pages RLS-là uniquement, on ne renvoie plus vers
 * /cliniques/ (le répertoire des TROIS territoires) — pour ne jamais offrir, même indirectement
 * (via le menu discret « i » de /monteregie-est/ → une de ces 3 pages), un chemin de clic vers les
 * cliniques des autres territoires. Contrairement au premier réflexe (retirer purement et
 * simplement le lien), on le REMPLACE par un lien vers /monteregie-est/ : les pages restent
 * indexables et gardent leur valeur SEO (le maillage interne du site n'est pas amputé), mais pour
 * un visiteur humain qui vient de l'univers Montérégie-Est, tout reste fermé sur ce territoire —
 * fil d'Ariane et bouton renvoient vers la carte Est plutôt que vers le répertoire des 3
 * territoires. Ces 3 RLS sont d'ailleurs exclusivement Montérégie-Est : aucune de leurs cliniques
 * n'appartient à un autre territoire, donc ce cadrage reste cohérent même pour un visiteur venu de
 * la carte générale.
 */
/* Territoire de chaque RLS — DÉDUIT de data.json plutôt qu'écrit à la main : un RLS
   appartient à un seul CISSS, et la liste bougerait à chaque territoire ajouté. Si un RLS
   apparaissait un jour à cheval sur deux territoires (erreur de saisie la plus probable), on
   s'arrête net : tout le cadrage régional en dépend. */
let REGION_DU_RLS = {};
function indexerRlsParRegion(cliniques) {
  const vu = {};
  for (const c of cliniques) {
    if (!rempli(c.rls) || !rempli(c.region)) continue;
    if (vu[c.rls] && vu[c.rls] !== c.region) {
      throw new Error(`RLS « ${c.rls} » rattaché à deux territoires (${vu[c.rls]} et ${c.region}) ` +
                      'dans data.json — corriger la donnée avant de régénérer les pages.');
    }
    vu[c.rls] = c.region;
  }
  REGION_DU_RLS = vu;
}

function pageRls(rls, liste, slugs, majDonnees, u = UNIVERS_GENERAL) {
  const slug = slugifier(rls);
  const urlGeneral = `${SITE}/rls/${slug}/`;
  const uRegion = UNIVERS_PAR_REGION[REGION_DU_RLS[rls]];
  const urlRegional = uRegion ? `${SITE}${uRegion.prefixe}/rls/${slug}/` : urlGeneral;
  const url = u.regional ? `${SITE}${u.prefixe}/rls/${slug}/` : urlGeneral;
  /* Même bascule SEO que pour les fiches de cliniques (voir pageClinique) : c'est le champ
     `canonique` de l'univers du territoire qui désigne l'adresse officielle. */
  const canonical = (uRegion && uRegion.canonique) ? urlRegional : urlGeneral;
  const indexable = url === canonical;
  const villes = [...new Set(liste.map(c => c.ville))].sort((a, b) => a.localeCompare(b, 'fr'));
  const types = [...new Set(liste.map(c => c.type))].sort((a, b) => a.localeCompare(b, 'fr'));
  const prats = [...new Set(liste.flatMap(c => c.pratiques || []))].map(p => PRATIQUES[p] || p).sort();

  /* 27 août 2026 : un RLS peut désormais contenir des milieux qui ne recrutent pas actuellement
     (recrutementActif:false). Ils restent publiés — chacun a sa propre page — mais dans une
     section séparée, sous un titre distinct, pour ne jamais gonfler le compte « qui recrutent »
     annoncé dans le titre et le résumé de cette page. */
  const actifs = liste.filter(recrute);
  const inactifs = liste.filter(c => !recrute(c));
  const villesActifs = [...new Set(actifs.map(c => c.ville))].sort((a, b) => a.localeCompare(b, 'fr'));

  // NB : le badge est un frère de <a>, jamais imbriqué dedans — un <button> à l'intérieur d'un
  // <a> est du HTML invalide (contenu interactif imbriqué) et casserait le clic/le focus.
  const item = c => `      <li>
        <a href="${u.prefixe}/cliniques/${slugs[String(c.id)]}/"><strong>${esc(c.nom)}</strong></a>${badgeVerif(c)}
        <span class="rep-meta">${esc(c.ville)} · ${esc(c.type)}${rempli(c.dme) ? ' · DMÉ ' + esc(c.dme) : ''}${recrute(c) ? '' : ' · Ne recrute pas actuellement'}</span>
      </li>`;
  const items = actifs.map(item).join('\n');
  const itemsInactifs = inactifs.map(item).join('\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': url + '#webpage', url,
        name: `Cliniques en recrutement — RLS ${rls} | Trouve ta clinique`,
        inLanguage: 'fr-CA', dateModified: majDonnees,
        isPartOf: { '@id': SITE + '/#website' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: u.regional ? [
          { '@type': 'ListItem', position: 1, name: u.nom, item: SITE + u.accueil },
          { '@type': 'ListItem', position: 2, name: 'RLS ' + rls, item: url }
        ] : [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Cliniques', item: SITE + '/cliniques/' },
          { '@type': 'ListItem', position: 3, name: 'RLS ' + rls, item: url }
        ]
      }
    ]
  };

  const corps = `  <section class="hero">
    <p class="eyebrow">Réseau local de services · Montérégie</p>
    <h1>Cliniques en recrutement — RLS ${esc(rls)}</h1>
    <p class="lead">${actifs.length} milieu${actifs.length > 1 ? 'x' : ''} du réseau local de services ${esc(rls)} recrute${actifs.length > 1 ? 'nt' : ''} actuellement des médecins de famille, réparti${actifs.length > 1 ? 's' : ''} dans ${villesActifs.length} municipalité${villesActifs.length > 1 ? 's' : ''} : ${esc(villesActifs.join(', '))}.${inactifs.length ? ` Le RLS compte aussi ${inactifs.length} autre${inactifs.length > 1 ? 's' : ''} milieu${inactifs.length > 1 ? 'x' : ''} publié${inactifs.length > 1 ? 's' : ''} à titre de référence, qui ${inactifs.length > 1 ? 'ne recrutent' : 'ne recrute'} pas actuellement.` : ''}</p>
    <p class="updated"><strong>Données mises à jour le :</strong> ${esc(majDonnees)}.</p>
    <div class="cta-row">
      <a class="button primary" href="${u.accueil}">Voir ce RLS sur la carte</a>
      ${u.regional
        ? `<a class="button secondary" href="${u.prefixe}/ptem/">Comprendre le PTEM</a>`
        : `<a class="button secondary" href="${EST_PREFIXE}/cliniques/">Toutes les cliniques</a>`}
      ${(!u.regional && uRegion)
        ? `<a class="button secondary" href="${uRegion.accueil}">${esc(uRegion.nom)}</a>` : ''}
    </div>
  </section>

  <div class="callout official"><strong>Pourquoi le RLS compte :</strong> l’avis de conformité PTEM précise la région ou le sous-territoire où le médecin doit réaliser au moins 55 % de ses jours de facturation. Le choix du RLS se fait donc en même temps que celui du milieu. <a href="${u.regional ? u.prefixe : EST_PREFIXE}/ptem/">Comprendre le PTEM →</a> <a class="source-chip" href="https://www.quebec.ca/gouvernement/travailler-gouvernement/sante-services-sociaux/travailler-comme-medecin-famille-quebec/plans-regionaux-effectifs-medicaux-medecine-famille" rel="noopener">Source officielle</a></div>

  <section id="milieux">
    <h2>Les ${actifs.length} milieu${actifs.length > 1 ? 'x' : ''} qui recrutent</h2>
    <ul class="repertoire">
${items}
    </ul>
  </section>
${inactifs.length ? `
  <section id="autres-milieux">
    <h2>Autres milieux du RLS <span class="compte">${inactifs.length}</span></h2>
    <p class="note">Publiés à titre de référence; ils ne recrutent pas de médecin de famille pour le moment.</p>
    <ul class="repertoire">
${itemsInactifs}
    </ul>
  </section>
` : ''}
  <section id="apercu">
    <h2>Aperçu du territoire</h2>
    <dl class="fiche">
      <dt>Types de milieux représentés</dt><dd>${esc(types.join(', '))}</dd>
      <dt>Municipalités</dt><dd>${esc(villes.join(', '))}</dd>
${prats.length ? `      <dt>Pratiques offertes dans le RLS</dt><dd>${esc(prats.join(', '))}</dd>` : ''}
    </dl>
    <p class="note">Ces éléments sont calculés à partir des fiches publiées ci-dessus; ils décrivent les milieux répertoriés par Trouve ta clinique, pas l’ensemble de l’offre du territoire.</p>
  </section>`;

  return { indexable, html: page({
    titre: `Cliniques en recrutement — RLS ${rls} (Montérégie) | Trouve ta clinique`,
    description: `Les ${actifs.length} cliniques en recrutement de médecins de famille du RLS ${rls}, en Montérégie : ${villesActifs.slice(0, 4).join(', ')}. Type de milieu, pratiques et fiche détaillée pour chacune.${inactifs.length ? ` ${inactifs.length} autre(s) milieu(x) du RLS, publiés à titre de référence, ne recrutent pas actuellement.` : ''}`,
    url, canonical, profondeur: 2, indexable, jsonLd, univers: u,
    actif: u.regional ? null : 'cliniques',
    filDAriane: u.regional
      ? `<a href="${u.accueil}">${esc(u.nom)}</a> › RLS ${esc(rls)}`
      : `<a href="/">Accueil</a> › <a href="${EST_PREFIXE}/cliniques/">Cliniques</a> › RLS ${esc(rls)}`,
    corps
  }) };
}

/* ------------------------------------------------------------------------------------------- */
/* HUB /monteregie-est/rls/ — les 3 RLS de l'univers Est, uniquement                            */
/* ------------------------------------------------------------------------------------------- */

/*
 * Ajouté le 22 août 2026 (question posée avant de coder : la décision du
 * 21 août ci-dessus retire volontairement toute entrée « Cliniques » de l'univers Est, pour ne
 * jamais offrir un chemin de clic vers les cliniques des autres territoires). Cette page-ci reste
 * cohérente avec ce choix : elle ne liste QUE les 3 RLS qui sont exclusivement Montérégie-Est
 * (REGION_DU_RLS) et ne pointe jamais ailleurs que dans son propre univers (carte, PTEM, AMP,
 * pages de RLS du territoire). Pas d'entrée dans la barre de navigation (actif reste null, comme
 * pageRls) : la page existe pour le maillage interne et le sitemap, pas comme onglet visible.
 * Généralisée aux trois territoires le 26 août 2026.
 */
function pageRlsHubRegion(u, parRls, majDonnees) {
  const url = `${SITE}${u.prefixe}/rls/`;

  const rangRls = rls => { const i = u.ordreRls.indexOf(rls); return i === -1 ? 99 : i; };
  const rlsPresents = [...parRls.keys()]
    .filter(rls => REGION_DU_RLS[rls] === u.region)
    .sort((a, b) => rangRls(a) - rangRls(b) || a.localeCompare(b, 'fr'));

  /* Ce hub reste focalisé sur le recrutement (voir son titre et son texte) : le compte affiché
     par RLS, et le total ci-dessous, ne portent donc que sur les milieux en recrutement — les
     milieux qui ne recrutent pas actuellement (recrutementActif:false) restent listés sur leur
     propre page de RLS (voir pageRls), pas ici. */
  const sections = rlsPresents.map(rls => {
    const liste = parRls.get(rls).filter(recrute);
    const villes = [...new Set(liste.map(c => c.ville))].sort((a, b) => a.localeCompare(b, 'fr'));
    return `  <section id="rls-${slugifier(rls)}">
    <h2>RLS ${esc(rls)} <span class="compte">${liste.length}</span></h2>
    <p class="rep-lien">${esc(villes.join(', '))}</p>
    <p class="rep-lien"><a href="${u.prefixe}/rls/${slugifier(rls)}/">Voir les ${liste.length} milieu${liste.length > 1 ? 'x' : ''} en recrutement du RLS ${esc(rls)} →</a></p>
  </section>`;
  }).join('\n\n');

  const total = rlsPresents.reduce((n, rls) => n + parRls.get(rls).filter(recrute).length, 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', '@id': url + '#webpage', url,
        name: `Réseaux locaux de services (RLS) — ${u.nom} | Trouve ta clinique`,
        inLanguage: 'fr-CA', dateModified: majDonnees,
        isPartOf: { '@id': SITE + '/#website' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: u.nom, item: SITE + u.accueil },
          { '@type': 'ListItem', position: 2, name: 'RLS', item: url }
        ]
      }
    ]
  };

  const corps = `  <section class="hero">
    <p class="eyebrow">Réseaux locaux de services · ${esc(u.nom)}</p>
    <h1>Les RLS de la ${esc(u.nom)}</h1>
    <p class="lead">Le territoire de la ${esc(u.nom)} compte <strong>${rlsPresents.length} ${rlsPresents.length > 1 ? 'réseaux locaux' : 'réseau local'} de services</strong>, avec au total ${total} milieu${total > 1 ? 'x' : ''} actuellement en recrutement de médecins de famille.</p>
    <p class="updated"><strong>Données mises à jour le :</strong> ${esc(majDonnees)}.</p>
    <div class="cta-row">
      <a class="button primary" href="${u.accueil}">Voir sur la carte interactive</a>
      <a class="button secondary" href="${u.prefixe}/ptem/">Comprendre le PTEM</a>
    </div>
  </section>

${sections}`;

  return page({
    titre: `Réseaux locaux de services (RLS) — ${u.nom} | Trouve ta clinique`,
    description: `Les ${rlsPresents.length} RLS de la ${u.nom} et leurs milieux en recrutement de médecins de famille.`,
    /* Indexable seulement là où le territoire tient aussi ses pages de RLS (voir `canonique`) :
       sinon ce hub renverrait Google vers des pages qu'on a nous-mêmes mises en noindex. */
    url, profondeur: 1, indexable: u.canonique, jsonLd, univers: u, actif: null,
    filDAriane: `<a href="${u.accueil}">${esc(u.nom)}</a> › RLS`,
    corps
  });
}

/* ------------------------------------------------------------------------------------------- */
/* RÉPERTOIRE /cliniques/                                                                       */
/* ------------------------------------------------------------------------------------------- */

/* 29 août 2026 : pageRepertoire() sert désormais AUSSI les trois hubs régionaux
   /monteregie-{est,centre,ouest}/cliniques/. Auparavant seul le hub de l'Est existait — livré à
   la main, jamais généré — donc Centre et Ouest répondaient 404 alors que leurs fiches
   individuelles existaient. Passer `u` (un UNIVERS_REGIONS) restreint la page au territoire et
   garde tous les liens à l'intérieur de l'univers. */
/* ------------------------------------------------------------------------------------------- */
/* STATUT PTEM — donnée centrale, mise à jour à un seul endroit                                 */
/* ------------------------------------------------------------------------------------------- */

/*
 * Mandat du 30 août 2026, §5 : ne jamais rendre l'information annuelle du PTEM permanente dans
 * le HTML. Toute page qui a besoin de dire où en est le cycle (l'accueil, notamment) lit cet
 * objet plutôt que d'écrire une phrase en dur. Pour changer d'année : modifier ces quatre
 * champs, rien d'autre. /ptem/ reste la source de vérité détaillée (avec ses liens sources) ;
 * ceci n'en est qu'un résumé pour les pages qui n'ont pas besoin de plus.
 */
const PTEM_STATUT = {
  enVigueur: 'PTEM 2026',
  finVigueur: '30 novembre 2026',
  prochain: 'PTEM 2027',
  periodeProchain: '1er décembre 2026 au 30 novembre 2027',
  cadreProchainOfficiel: true,   // l'Accord régissant le prochain cycle est déjà publié
  placesProchainPublies: false   // le tableau des places, lui, ne l'est pas encore
};

function phrasePtemCourte() {
  const { enVigueur, finVigueur, prochain, cadreProchainOfficiel, placesProchainPublies } = PTEM_STATUT;
  if (placesProchainPublies) {
    return `Le ${prochain} est maintenant en vigueur.`;
  }
  return `Le ${enVigueur} est actuellement en vigueur jusqu'au ${finVigueur}. Le cadre du `
    + `${prochain}${cadreProchainOfficiel ? ' est déjà officiel' : " n'est pas encore officiel"}`
    + ` ; les places par territoire seront ajoutées dès leur publication.`;
}

/* ------------------------------------------------------------------------------------------- */
/* PAGE D'ACCUEIL                                                                               */
/* ------------------------------------------------------------------------------------------- */

/*
 * Mandat du 30 août 2026, §4 : Montérégie-Est en action principale, chiffres 100% dynamiques
 * (aucun nombre ni date en dur nulle part, y compris JSON-LD/OG), pas de chiffre pour Centre et
 * Ouest sur cette page, pas de compte des fiches « Vérifié ». « toutes » ici doit être la liste
 * BRUTE de data.json (cliniques ET établissements confondus). Les établissements sont publiés
 * dans leur couche cartographique dédiée même si leur ancien drapeau visible vaut false — pas le
 * tableau `cliniques` déjà filtré hors établissements qui sert aux fiches individuelles.
 *
 * Depuis la bascule atomique du 31 août 2026, cette fonction écrit la vraie racine index.html;
 * l'application carte complète est générée séparément dans /monteregie/.
 */
function pageAccueil(toutesEntrees, majDonnees) {
  const publiees = toutesEntrees.filter(c =>
    rempli(c.nom) && (c.visible !== false || c.categorie === 'etablissement')
  );
  const totalGeneral = publiees.length;
  const totalEst = publiees.filter(c => c.region === 'Est').length;

  const RLS_EST = ['Pierre-Boucher', 'Richelieu-Yamaska', 'Pierre-De Saurel'];
  const RLS_AUTRES = [
    ['Champlain', '/rls/champlain/'],
    ['Haut-Richelieu–Rouville', '/rls/haut-richelieu-rouville/'],
    ['Jardins-Roussillon', '/rls/jardins-roussillon/'],
    ['Vaudreuil-Soulanges', '/rls/vaudreuil-soulanges/'],
    ['du Suroît', '/rls/du-suroit/'],
    ['du Haut-Saint-Laurent', '/rls/du-haut-saint-laurent/']
  ];
  const rlsEstHtml = RLS_EST.map(nom =>
    `      <a href="/monteregie-est/rls/${slugifier(nom)}/">${esc(nom)}</a>`).join('\n');
  const rlsAutresHtml = RLS_AUTRES.map(([nom, href]) =>
    `      <a href="${href}">${esc(nom)}</a>`).join('\n');

  const url = `${SITE}/`;
  const titre = 'Trouve ta clinique — Cliniques qui recrutent en médecine familiale | Montérégie';
  const description = `Carte interactive des cliniques et établissements de la Montérégie. `
    + `Coordonnées, horaires, équipe et personne-ressource pour préparer votre PTEM en médecine `
    + `familiale.`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite', '@id': `${url}#website`, name: 'Trouve ta clinique', url,
        inLanguage: 'fr-CA', description,
        publisher: { '@id': `${url}#auteur` }
      },
      { '@type': 'Person', '@id': `${url}#auteur`, name: 'Olivier Laplante',
        jobTitle: 'Résident en médecine familiale', url },
      { '@type': 'WebPage', '@id': `${url}#accueil`, url, name: titre,
        isPartOf: { '@id': `${url}#website` },
        about: { '@type': 'Place', name: 'Montérégie, Québec' },
        dateModified: majDonnees }
    ]
  };

  const corps = `
<section class="hero">
  <p class="eyebrow">Médecine familiale</p>
  <h1>Trouvez une clinique qui recrute en médecine familiale</h1>
  <p class="lead">${totalGeneral} milieux de pratique répertoriés en Montérégie — cliniques et
     établissements confondus, qu'ils recrutent actuellement ou non. Coordonnées, horaires,
     équipe et personne-ressource pour préparer votre ${esc(PTEM_STATUT.prochain)}, ou pour
     comparer les milieux avant de choisir.</p>
  <div class="cta-row">
    <a class="button primary" href="/monteregie-est/">Explorer Montérégie-Est</a>
  </div>
</section>

<div class="fact-grid fact-grid-2">
  <div class="fact-card">
    <span class="fact-kicker">Au total</span>
    <strong>${totalGeneral}</strong>
    <span>milieux de pratique répertoriés en Montérégie</span>
  </div>
  <div class="fact-card">
    <span class="fact-kicker">Montérégie-Est</span>
    <strong>${totalEst}</strong>
    <span>milieux de pratique répertoriés</span>
  </div>
</div>

<h2>Explorer par territoire</h2>
<a class="terr-priorite terr-priorite-est" href="/monteregie-est/">
  <strong>Montérégie-Est</strong>
  <span>Pierre-Boucher, Richelieu-Yamaska, Pierre-De Saurel</span>
  <span class="text-cta">Ouvrir la carte →</span>
</a>
<h3 class="soustitre">Autres territoires de la Montérégie <span class="note-construction">(en construction)</span></h3>
<p class="terr-autres-note">Les cartes Centre et Ouest sont en préparation ; seule la Montérégie-Est est pleinement disponible pour l'instant.</p>
<div class="terr-autres">
  <a class="button ghost" href="/monteregie-centre/">Montérégie-Centre</a>
  <a class="button ghost" href="/monteregie-ouest/">Montérégie-Ouest</a>
</div>

<h2>Comment l'utiliser</h2>
<p class="lead" style="font-size:1rem">Que vous soyez résident en fin de formation ou déjà en
   pratique et à la recherche d'un nouveau milieu.</p>
<div class="card-grid">
  <div class="card accent-blue"><h3>1. Explorer</h3>
    <p>Filtrez par territoire, réseau local ou type de pratique. Chaque épingle mène à une fiche
       complète du milieu.</p></div>
  <div class="card accent-teal"><h3>2. Comparer</h3>
    <p>Mettez des milieux en favoris, ajoutez vos notes, exportez un tableau comparatif — tout
       reste sur votre appareil.</p></div>
  <div class="card accent-mint"><h3>3. Contacter</h3>
    <p>Quand une clinique a transmis une personne-ressource au recrutement, elle figure sur sa
       fiche.</p></div>
</div>

<h2>${esc(PTEM_STATUT.prochain)} et AMP</h2>
<p class="lead" style="font-size:1rem">${phrasePtemCourte()}</p>
<div class="card-grid two">
  <div class="card accent-blue">
    <h3>Le ${esc(PTEM_STATUT.prochain)}</h3>
    <p>Le plan territorial d'effectifs médicaux — souvent encore appelé PREM — détermine où un
       médecin de famille peut s'installer et à quelles conditions.</p>
    <a class="text-cta" href="${EST_PREFIXE}/ptem/">Tout savoir sur le ${esc(PTEM_STATUT.prochain)} →</a>
  </div>
  <div class="card accent-teal">
    <h3>Les AMP</h3>
    <p>Les activités médicales particulières sont les obligations de pratique rattachées à votre
       territoire durant vos premières années.</p>
    <a class="text-cta" href="${EST_PREFIXE}/amp/">Comprendre les AMP →</a>
  </div>
</div>

<h2>Parcourir par réseau local de services (RLS)</h2>
<h3 class="soustitre">Montérégie-Est</h3>
<div class="rls-liste rls-liste-est">
${rlsEstHtml}
</div>
<h3 class="soustitre">Autres RLS de la Montérégie</h3>
<div class="rls-liste rls-liste-autres">
${rlsAutresHtml}
</div>

<div class="fact-card encart-gp">
  <h2 style="margin-top:0">Vous cherchez une clinique comme patient ?</h2>
  <p>Ce site s'adresse aux médecins et aux résidents qui cherchent un milieu où pratiquer. Il ne
     permet pas de prendre rendez-vous ni de s'inscrire auprès d'un médecin de famille.</p>
  <p>Pour trouver une consultation, passez par
     <a href="https://www.quebec.ca/sante/trouver-une-ressource/medecin-de-famille-prendre-rendez-vous-en-ligne" rel="noopener">Rendez-vous santé Québec</a>,
     ou composez le <strong>811, option 1</strong> (Info-Santé) pour un avis infirmier. Pour vous
     inscrire auprès d'un médecin de famille, utilisez le
     <a href="https://www.quebec.ca/sante/trouver-une-ressource/guichet-acces-medecin-famille" rel="noopener">guichet d'accès à un médecin de famille</a>.</p>
</div>

<div class="apropos-discret">
  <h2>D'où viennent ces informations</h2>
  <p>Ce projet est développé et tenu à jour par un résident en médecine familiale, avec la
     collaboration du Recrutement médical de Santé Québec - Montérégie-Est. Les fiches
     sont constituées à partir des renseignements transmis par les cliniques elles-mêmes,
     complétés par des sources publiques et vérifiés manuellement.</p>
  <p>Initiative bénévole, indépendante et sans but lucratif. Elle ne remplace aucune démarche
     officielle. Une erreur ou une information à corriger ? Les signalements sont bienvenus.</p>
  <p class="maj">Données mises à jour le <time datetime="${esc(majDonnees)}">${esc(dateLisibleFr(majDonnees))}</time>.</p>
</div>
`;

  const html = page({
    titre, description, url, profondeur: 0, indexable: true, canonical: url, jsonLd,
    filDAriane: '', corps, actif: 'accueil', univers: UNIVERS_GENERAL
  });
  return { html, indexable: true };
}

function pageRepertoire(cliniques, slugs, parRls, majDonnees, u = null) {


  const prefixe = u ? u.prefixe : '';
  const nomTerritoire = u ? u.nom : 'Montérégie';
  const url = `${SITE}${prefixe}/cliniques/`;
  const villes = new Set(cliniques.map(c => c.ville));

  const enRecrutementTotal = cliniques.filter(recrute).length;
  const sections = [...parRls.keys()].sort((a, b) => a.localeCompare(b, 'fr')).map(rls => {
    const liste = parRls.get(rls);
    const items = liste.map(c => `      <li>
        <a href="${prefixe}/cliniques/${slugs[String(c.id)]}/"><strong>${esc(c.nom)}</strong></a>${badgeVerif(c)}
        <span class="rep-meta">${esc(c.ville)} · ${esc(c.type)}${recrute(c) ? '' : ' · Ne recrute pas actuellement'}</span>
      </li>`).join('\n');
    return `  <section id="rls-${slugifier(rls)}">
    <h2>RLS ${esc(rls)} <span class="compte">${liste.length}</span></h2>
    <p class="rep-lien"><a href="${prefixe}/rls/${slugifier(rls)}/">Voir la page du RLS ${esc(rls)} →</a></p>
    <ul class="repertoire">
${items}
    </ul>
  </section>`;
  }).join('\n\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', '@id': url + '#webpage', url,
        name: `Cliniques en recrutement en ${nomTerritoire} | Trouve ta clinique`,
        inLanguage: 'fr-CA', dateModified: majDonnees,
        isPartOf: { '@id': SITE + '/#website' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: u
          ? [
              { '@type': 'ListItem', position: 1, name: u.nom, item: SITE + u.accueil },
              { '@type': 'ListItem', position: 2, name: 'Cliniques', item: url }
            ]
          : [
              { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
              { '@type': 'ListItem', position: 2, name: 'Cliniques', item: url }
            ]
      }
    ]
  };

  const corps = `  <section class="hero">
    <p class="eyebrow">Médecine familiale · Montérégie</p>
    <h1>Cliniques en recrutement en ${esc(nomTerritoire)}</h1>
    <p class="lead"><strong>${enRecrutementTotal} milieu${enRecrutementTotal > 1 ? 'x' : ''} en recrutement actif</strong> de médecins de famille, sur ${cliniques.length} milieux publiés au total dans le répertoire, répartis dans <strong>${parRls.size} RLS</strong> et ${villes.size} municipalités${enRecrutementTotal < cliniques.length ? ` — les autres milieux publiés le sont à titre de référence et ne recrutent pas actuellement` : ''}. Chaque fiche permet de comparer les caractéristiques disponibles; la <a href="${u ? u.accueil : UNIVERS_GENERAL.accueil}">carte interactive</a> ajoute les filtres et la vue géographique.</p>
    <p class="updated"><strong>Données mises à jour le :</strong> ${esc(majDonnees)}.</p>
    <div class="cta-row">
      <a class="button primary" href="${u ? u.accueil : UNIVERS_GENERAL.accueil}">Explorer sur la carte interactive</a>
      <a class="button secondary" href="${u ? u.prefixe : EST_PREFIXE}/ptem/">Guide PTEM</a>
    </div>
  </section>

  ${u ? '' : `<section id="territoires">
    <h2>Explorer par territoire</h2>
    <ul class="repertoire">
${UNIVERS_REGIONS.map(v => `      <li><a href="${v.accueil}"><strong>${esc(v.nom)}</strong></a>
        <span class="rep-meta">${v.ordreRls.length} RLS · ${esc(v.ordreRls.join(', '))}</span></li>`).join('\n')}
    </ul>
  </section>`}

  ${htmlBanniereSqb(u ? '../../assets' : '../assets')}

  <div class="callout official"><strong>Comment choisir :</strong> le RLS peut être déterminant pour l’avis de conformité PTEM, qui exige au moins 55 % des jours de facturation dans le territoire visé. Le type de milieu (GMF, GMF-U, CLSC…), le DMÉ, les frais de bureau et les pratiques offertes aident ensuite à comparer le quotidien de pratique. <a class="source-chip" href="https://www.quebec.ca/gouvernement/travailler-gouvernement/sante-services-sociaux/travailler-comme-medecin-famille-quebec/plans-regionaux-effectifs-medicaux-medecine-famille" rel="noopener">Source officielle</a></div>

${sections}`;

  return page({
    titre: `Cliniques en recrutement en ${nomTerritoire} | Trouve ta clinique`,
    description: `Répertoire des ${cliniques.length} milieux publiés en ${nomTerritoire} (dont ${enRecrutementTotal} en recrutement actif de médecins de famille), classés par ${parRls.size} RLS avec fiche détaillée.`,
    url, profondeur: u ? 2 : 1, indexable: true, jsonLd, actif: 'cliniques', univers: u || UNIVERS_GENERAL,
    filDAriane: u ? `<a href="${u.accueil}">${esc(u.nom)}</a> › Cliniques` : `<a href="/">Accueil</a> › Cliniques`,
    corps
  });
}

/* ------------------------------------------------------------------------------------------- */
/* SITEMAP                                                                                      */
/* ------------------------------------------------------------------------------------------- */

/* Pages de contenu écrites à la main (pas générées). Ajouter ici toute nouvelle page-guide. */
/* ------------------------------------------------------------------------------------------- */
/* PAGES SEO DES SECTEURS EN ÉTABLISSEMENT                                                      */
/* ------------------------------------------------------------------------------------------- */
/*
 * Premier lot (3 sept. 2026), avant le 24 : un répertoire + trois pages contrastées.
 * Les dix-sept autres installations et les ancres GMF-U viendront après validation du gabarit.
 *
 * Trois règles d'affichage — identiques à la carte, et DISTINCTES des pages de cliniques :
 * aucun ETC, aucun nom ni courriel de responsable, contact « À venir ».
 * JSON-LD : pas de contactPoint, pas de JobPosting.
 */
const DATE_SOURCE_ETABLISSEMENTS = '2026-08-28';
const PREMIER_LOT_ETABLISSEMENTS = ['INS-012', 'INS-003', 'INS-018'];
const GMFU_CONDITION_SEO = 'Recrutements en GMF-U : la candidature doit avoir obtenu l’aval du directeur du département universitaire de médecine familiale de la faculté de médecine concernée. Le médecin devra avoir le profil attendu en termes de tâches liées à des fonctions académiques et en termes d’inscription de patients.';
const NOTE_SOURCE_ETABLISSEMENTS = 'les secteurs en recrutement présentés sur cette page proviennent du relevé des besoins en effectifs médicaux 2027 du CISSS de la Montérégie-Est, transmis le 28 août 2026. Ils indiquent qu’un recrutement est en cours dans le secteur, sans préjuger du nombre de postes, de leur répartition ni des modalités d’exercice, qui se précisent avec le milieu. Ces renseignements peuvent évoluer; pour le PTEM et les AMP, les sources officielles et le DTMF priment.';
const CALLOUT_CONTACT_ETABLISSEMENT = '<div class="callout"><strong>Pour joindre ce milieu au sujet du recrutement :</strong> le contact à privilégier pour les secteurs en établissement sera publié prochainement. En attendant, adressez-vous au service de recrutement médical du CISSS de la Montérégie-Est.</div>';

const TYPE_ETAB_SEO = {
  hopital: 'Hôpital',
  chsld: 'CHSLD',
  clsc: 'CLSC',
  'gmf-u': 'GMF-U',
  crd: 'Centre de réadaptation',
  detention: 'Centre de détention'
};

function typeEtablissementLibelle(type) {
  return TYPE_ETAB_SEO[type] || type || '';
}

function typeSchemaEtablissement(type) {
  if (type === 'hopital') return 'Hospital';
  if (type === 'chsld') return 'NursingHome';
  return 'MedicalClinic';
}

function chargerDonneesEtablissements() {
  return JSON.parse(fs.readFileSync(path.join(RACINE, 'data-etablissements.json'), 'utf8'));
}

function slugEtablissement(inst) {
  return slugifier(inst.nom);
}

function secteursDe(donnees, installationId) {
  return (donnees.secteurs || []).filter(s => s.installationId === installationId);
}

function lienCarteInstallation(id) {
  return `${EST_PREFIXE}/?mode=etablissements&installation=${encodeURIComponent(id)}`;
}

function adresseCompleteEtablissement(inst) {
  const rue = (inst.adresse || '').trim();
  const ville = (inst.ville || '').trim();
  const cp = (inst.codePostal || '').trim();
  if (rue && ville && cp) return `${rue}, ${ville} QC ${cp}`;
  if (rue && ville) return `${rue}, ${ville}`;
  return rue || ville || '';
}

function listeSecteursHumaine(secteurs) {
  const noms = secteurs.map(s => s.libelle);
  if (noms.length === 0) return '';
  if (noms.length === 1) return noms[0];
  if (noms.length === 2) return noms[0] + ' et ' + noms[1];
  return noms.slice(0, -1).join(', ') + ' et ' + noms[noms.length - 1];
}

function nombreEnLettresFr(n) {
  return ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'][n] || String(n);
}

function eyebrowEtablissement(inst) {
  const type = typeEtablissementLibelle(inst.type);
  if (inst.missionRegionale) return `${type} · Mission régionale`;
  return `${type} · RLS ${inst.territoireSource}`;
}

function hrefPageOuCarte(inst, slugsCliniques, lot) {
  if (lot.has(inst.id)) {
    return `${EST_PREFIXE}/etablissements/${slugEtablissement(inst)}/`;
  }
  const ref = inst.referenceExistante;
  if (inst.type === 'gmf-u' && ref && ref.collection === 'cliniques') {
    const slug = slugsCliniques[String(ref.id)];
    if (slug) return `${EST_PREFIXE}/cliniques/${slug}/`;
  }
  return lienCarteInstallation(inst.id);
}

function paragraphesSecteur(s, inst) {
  if (inst.id === 'INS-012') {
    const hotelDieu = {
      urgence: '<p>Le service d’urgence de l’Hôtel-Dieu de Sorel dessert la population du RLS Pierre-De Saurel. Le secteur est en recrutement.</p>',
      hospitalisation: '<p>La prise en charge des patients hospitalisés est en recrutement. Cette pratique se combine fréquemment à d’autres secteurs du même établissement.</p>',
      ucdg: '<p>L’unité de courte durée gériatrique accueille des personnes âgées en perte d’autonomie pour une évaluation et une réadaptation de courte durée. Le secteur est en recrutement.</p>',
      obstetrique: '<p>Le secteur d’obstétrique est en recrutement. L’Hôtel-Dieu de Sorel est le seul établissement du RLS Pierre-De Saurel offrant ce service.</p>',
      'soins-intensifs': '<p>Les soins intensifs de l’Hôtel-Dieu de Sorel forment une unité de six lits ou moins. Le secteur est en recrutement.</p>'
    };
    if (hotelDieu[s.ancre]) return hotelDieu[s.ancre];
  }
  const extra = [];
  if (s.categorieActivite === 'longue-duree') {
    extra.push('<p>Le secteur de longue durée d’un CHSLD assure le suivi médical des personnes hébergées. Le secteur est en recrutement.</p>');
  } else if (s.categorieActivite === 'crd') {
    extra.push('<p>Un centre de réadaptation en dépendance offre des services spécialisés aux personnes aux prises avec un trouble lié à l’usage de substances. Le secteur est en recrutement.</p>');
  } else if (s.categorieActivite === 'urgence') {
    extra.push('<p>Le service d’urgence dessert la population du territoire. Le secteur est en recrutement.</p>');
  } else if (s.categorieActivite === 'hospitalisation') {
    extra.push('<p>La prise en charge des patients hospitalisés est en recrutement.</p>');
  } else if (s.categorieActivite === 'ucdg') {
    extra.push('<p>L’unité de courte durée gériatrique accueille des personnes âgées en perte d’autonomie pour une évaluation et une réadaptation de courte durée. Le secteur est en recrutement.</p>');
  } else if (s.categorieActivite === 'gmf-u') {
    extra.push(`<p>Le secteur GMF-U est en recrutement.</p><p>${esc(GMFU_CONDITION_SEO)}</p>`);
  } else {
    extra.push(`<p>Le secteur ${esc(s.libelle)} est en recrutement pour le cycle 2027.</p>`);
  }
  if (s.regroupe) {
    extra.push('<p>Le besoin est regroupé : les modalités se précisent avec le milieu.</p>');
  }
  if (inst.id === 'INS-018') {
    extra.push('<p>Ce site relève de la Montérégie-Ouest. Il est présenté ici comme mission régionale du CISSS de la Montérégie-Est, et non comme un RLS « Régional » — ce territoire n’existe pas.</p>');
  }
  if (inst.id === 'INS-005') {
    extra.push('<p>Le service dessert Varennes, Verchères et possiblement d’autres points de service.</p>');
  }
  return extra.join('\n    ');
}

function titreH3Secteur(s) {
  if (s.categorieActivite === 'ucdg') return 'UCDG — unité de courte durée gériatrique';
  return s.libelle;
}

function chapeauEtablissement(inst, secteurs) {
  if (inst.id === 'INS-012') {
    return 'L’Hôtel-Dieu de Sorel est l’hôpital du réseau local de services Pierre-De Saurel, à Sorel-Tracy. Cinq de ses secteurs d’activité recrutent actuellement des médecins de famille : l’urgence, l’hospitalisation, l’unité de courte durée gériatrique, l’obstétrique et les soins intensifs. Cette page présente chacun d’eux, tels que déclarés par le CISSS de la Montérégie-Est pour le cycle de besoins 2027.';
  }
  if (inst.id === 'INS-003') {
    return 'Le centre d’hébergement de Contrecoeur est un CHSLD du RLS Pierre-Boucher. Son secteur de longue durée recrute actuellement des médecins de famille. Cette page présente ce secteur, tel que déclaré par le CISSS de la Montérégie-Est pour le cycle de besoins 2027.';
  }
  const n = secteurs.length;
  const liste = listeSecteursHumaine(secteurs);
  if (inst.missionRegionale && inst.id === 'INS-018') {
    return `Le centre de réadaptation en dépendance de Saint-Philippe est une mission régionale. Le site se trouve à Saint-Philippe, en Montérégie-Ouest ; il est présenté ici parce que le relevé des besoins 2027 du CISSS de la Montérégie-Est l’inclut. ${n === 1 ? 'Son secteur' : 'Ses secteurs'} d’activité en recrutement : ${esc(liste)}.`;
  }
  if (inst.missionRegionale) {
    return `${esc(inst.nom)} est une mission régionale. ${n === 1 ? 'Son secteur' : 'Ses secteurs'} en recrutement : ${esc(liste)}. Cette page reprend le relevé des besoins 2027 du CISSS de la Montérégie-Est.`;
  }
  const type = typeEtablissementLibelle(inst.type).toLowerCase();
  const rls = inst.territoireSource || '';
  if (n === 1) {
    return `Le ${type} ${esc(inst.nom)} se trouve à ${esc(inst.ville)}, dans le RLS ${esc(rls)}. Son secteur d’activité en recrutement est ${esc(liste)}. Cette page reprend le relevé des besoins 2027 du CISSS de la Montérégie-Est.`;
  }
  return `${esc(inst.nom)} se trouve à ${esc(inst.ville)}, dans le RLS ${esc(rls)}. ${nombreEnLettresFr(n).replace(/^./, c => c.toUpperCase())} secteurs d’activité recrutent actuellement des médecins de famille : ${esc(liste)}. Cette page reprend le relevé des besoins 2027 du CISSS de la Montérégie-Est.`;
}

function pageEtablissement(inst, secteurs, majPagesSeo) {
  const u = UNIVERS_PAR_REGION.Est;
  const slug = slugEtablissement(inst);
  const url = `${SITE}${EST_PREFIXE}/etablissements/${slug}/`;
  const typeLib = typeEtablissementLibelle(inst.type);
  const n = secteurs.length;
  const liste = listeSecteursHumaine(secteurs);
  const titre = `${inst.nom} — secteurs en recrutement | Trouve ta clinique`;
  const description = inst.id === 'INS-012'
    ? 'Hôtel-Dieu de Sorel, hôpital de Sorel-Tracy (RLS Pierre-De Saurel) : cinq secteurs en recrutement de médecins — urgence, hospitalisation, UCDG, obstétrique et soins intensifs.'
    : `${inst.nom}, ${typeLib.toLowerCase()} à ${inst.ville}${inst.missionRegionale ? ' (mission régionale)' : ' (RLS ' + inst.territoireSource + ')'} : ${n === 1 ? 'secteur en recrutement' : n + ' secteurs en recrutement'} — ${liste}.`;
  const h2 = n === 1 ? 'Le secteur en recrutement' : `Les ${nombreEnLettresFr(n)} secteurs en recrutement`;
  const introSecteurs = n === 1
    ? '<p>Le secteur ci-dessous est déclaré en recrutement pour le cycle 2027. Les modalités — volume, garde, répartition entre plusieurs médecins — se discutent avec le milieu : elles ne sont pas fixées ici.</p>'
    : '<p>Chaque secteur ci-dessous est déclaré en recrutement pour le cycle 2027. Les modalités — volume, garde, répartition entre plusieurs médecins — se discutent avec le milieu : elles ne sont pas fixées ici.</p>';
  const blocsSecteurs = secteurs.map(s => `    <h3 id="${esc(s.ancre)}">${esc(titreH3Secteur(s))}</h3>
    ${paragraphesSecteur(s, inst)}`).join('\n\n');
  const lienRls = (!inst.missionRegionale && inst.territoireSource)
    ? `${EST_PREFIXE}/rls/${slugifier(inst.territoireSource)}/`
    : null;
  const libelleSite = inst.id === 'INS-012'
    ? 'Fiche Santé Montérégie de l’Hôtel-Dieu de Sorel'
    : `Fiche Santé Montérégie — ${inst.nom}`;
  const siteOfficiel = inst.lienWeb
    ? `<a href="${esc(inst.lienWeb)}" rel="noopener">${esc(libelleSite)}</a>`
    : 'À venir';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': url + '#webpage',
        url,
        name: `${inst.nom} — secteurs en recrutement en Montérégie-Est | Trouve ta clinique`,
        inLanguage: 'fr-CA',
        dateModified: majPagesSeo,
        isPartOf: { '@id': SITE + '/#website' },
        about: { '@id': url + '#etablissement' }
      },
      {
        '@type': typeSchemaEtablissement(inst.type),
        '@id': url + '#etablissement',
        name: inst.nom,
        url,
        ...(inst.lienWeb ? { sameAs: inst.lienWeb } : {}),
        address: {
          '@type': 'PostalAddress',
          addressLocality: inst.ville || '',
          addressRegion: 'QC',
          addressCountry: 'CA',
          ...(inst.codePostal ? { postalCode: inst.codePostal } : {}),
          ...(inst.adresse ? { streetAddress: inst.adresse } : {})
        },
        ...(Number.isFinite(Number(inst.lat)) && Number.isFinite(Number(inst.lng))
          ? { geo: { '@type': 'GeoCoordinates', latitude: inst.lat, longitude: inst.lng } }
          : {})
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Montérégie-Est', item: SITE + EST_ACCUEIL },
          { '@type': 'ListItem', position: 2, name: 'Secteurs en établissement', item: SITE + EST_PREFIXE + '/etablissements/' },
          { '@type': 'ListItem', position: 3, name: inst.nom, item: url }
        ]
      }
    ]
  };
  const territoireDd = inst.missionRegionale
    ? 'Mission régionale'
    : (lienRls
      ? `<a href="${lienRls}">${esc(inst.territoireSource)}</a>`
      : esc(inst.territoireSource || ''));
  const corps = `  <section class="hero">
    <p class="eyebrow">${esc(eyebrowEtablissement(inst))}</p>
    <h1>${esc(inst.nom)} — secteurs en recrutement</h1>
    <p class="lead">${chapeauEtablissement(inst, secteurs)}</p>
    <p class="updated"><strong>Données déclarées par le milieu le :</strong> ${DATE_SOURCE_ETABLISSEMENTS}.</p>
    <div class="cta-row">
      <a class="button primary" href="${esc(lienCarteInstallation(inst.id))}">Voir sur la carte interactive</a>
      <a class="button secondary" href="${EST_PREFIXE}/etablissements/">Tous les secteurs en établissement</a>
    </div>
  </section>

  ${CALLOUT_CONTACT_ETABLISSEMENT}

  <section id="secteurs">
    <h2>${esc(h2)}</h2>
    ${introSecteurs}

${blocsSecteurs}
  </section>

  <section id="renseignements">
    <h2>Renseignements sur le lieu</h2>
    <dl class="fiche">
      <dt>Type de milieu</dt><dd>${esc(typeLib)}</dd>
      <dt>Ville</dt><dd>${esc(inst.ville || '')}</dd>
      <dt>Adresse</dt><dd>${esc(adresseCompleteEtablissement(inst))}</dd>
      <dt>Territoire</dt><dd>Montérégie-Est</dd>
      <dt>Réseau local de services (RLS)</dt><dd>${territoireDd}</dd>
      <dt>Secteurs en recrutement</dt><dd>${esc(secteurs.map(s => s.libelle).join(' · '))}</dd>
      <dt>Contact recrutement</dt><dd>À venir</dd>
      <dt>Site officiel</dt><dd>${siteOfficiel}</dd>
    </dl>
  </section>

  <div class="data-note"><strong>Source et vérification :</strong> ${NOTE_SOURCE_ETABLISSEMENTS}</div>

  <section id="suite">
    <h2>Pour aller plus loin</h2>
    <ul class="source-list">
      <li><a href="${EST_PREFIXE}/etablissements/">Tous les secteurs en recrutement en établissement de la Montérégie-Est</a></li>
      ${lienRls ? `<li><a href="${lienRls}">Autres milieux du RLS ${esc(inst.territoireSource)}</a></li>` : '<li><a href="' + EST_PREFIXE + '/rls/">Réseaux locaux de services de la Montérégie-Est</a></li>'}
      <li><a href="${EST_PREFIXE}/ptem/">Comprendre le PTEM et l’avis de conformité</a></li>
      <li><a href="${EST_PREFIXE}/amp/">Comprendre les activités médicales particulières (AMP)</a></li>
      <li><a href="${esc(lienCarteInstallation(inst.id))}">Fiche complète et itinéraire sur la carte interactive</a></li>
    </ul>
  </section>`;

  return {
    html: page({
      titre, description, url, profondeur: 3, indexable: true, jsonLd,
      filDAriane: `<a href="${EST_ACCUEIL}">Montérégie-Est</a> › <a href="${EST_PREFIXE}/etablissements/">Secteurs en établissement</a> › ${esc(inst.nom)}`,
      corps, actif: 'etablissements', univers: u
    }),
    indexable: true,
    slug, url
  };
}

function pageRepertoireEtablissements(donnees, slugsCliniques, majPagesSeo) {
  const u = UNIVERS_PAR_REGION.Est;
  const url = `${SITE}${EST_PREFIXE}/etablissements/`;
  const lot = new Set(PREMIER_LOT_ETABLISSEMENTS);
  const installations = (donnees.installations || []).filter(i => !i.publication || i.publication.visible !== false);
  const groupes = [
    { id: 'Pierre-Boucher', titre: 'RLS Pierre-Boucher', rls: true },
    { id: 'Richelieu-Yamaska', titre: 'RLS Richelieu-Yamaska', rls: true },
    { id: 'Pierre-De Saurel', titre: 'RLS Pierre-De Saurel', rls: true },
    { id: 'missions', titre: 'Missions régionales', rls: false }
  ];
  const sections = groupes.map(g => {
    const liste = installations.filter(i => g.id === 'missions' ? i.missionRegionale : (!i.missionRegionale && i.territoireSource === g.id));
    if (!liste.length) return '';
    const items = liste.map(inst => {
      const secteurs = secteursDe(donnees, inst.id);
      const href = hrefPageOuCarte(inst, slugsCliniques, lot);
      const meta = [typeEtablissementLibelle(inst.type), inst.ville, listeSecteursHumaine(secteurs)].filter(Boolean).join(' · ');
      const viaCarte = !lot.has(inst.id);
      const note = inst.type === 'gmf-u'
        ? 'Page de la clinique GMF-U'
        : (viaCarte ? 'Fiche sur la carte' : `${secteurs.length} secteur${secteurs.length > 1 ? 's' : ''}`);
      return `      <li>
        <a href="${esc(href)}"><strong>${esc(inst.nom)}</strong></a>
        <span class="rep-meta">${esc(meta)} · ${esc(note)}</span>
      </li>`;
    }).join('\n');
    const lienRls = g.rls ? `<p class="rep-lien"><a href="${EST_PREFIXE}/rls/${slugifier(g.id)}/">Voir la page du RLS ${esc(g.id)} →</a></p>` : '';
    return `  <section id="${g.id === 'missions' ? 'missions-regionales' : 'rls-' + slugifier(g.id)}">
    <h2>${esc(g.titre)} <span class="compte">${liste.length}</span></h2>
    ${lienRls}
    <ul class="repertoire">
${items}
    </ul>
  </section>`;
  }).filter(Boolean).join('\n\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', '@id': url + '#webpage', url,
        name: 'Secteurs en établissement en Montérégie-Est | Trouve ta clinique',
        inLanguage: 'fr-CA', dateModified: majPagesSeo,
        isPartOf: { '@id': SITE + '/#website' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Montérégie-Est', item: SITE + EST_ACCUEIL },
          { '@type': 'ListItem', position: 2, name: 'Secteurs en établissement', item: url }
        ]
      }
    ]
  };

  const corps = `  <section class="hero">
    <p class="eyebrow">Médecine familiale · Montérégie-Est</p>
    <h1>Secteurs en recrutement en établissement</h1>
    <p class="lead">La pratique en établissement, pour un médecin de famille, ce n’est pas une clinique : c’est l’urgence, l’hospitalisation, l’unité de courte durée gériatrique, la longue durée, les soins à domicile, ou une mission régionale (réadaptation, détention). Les installations ci-dessous sont celles du relevé des besoins 2027 du CISSS de la Montérégie-Est. Trois d’entre elles ont déjà une fiche détaillée ; les autres s’ouvrent sur la carte, en attendant la suite.</p>
    <p class="updated"><strong>Données déclarées par le milieu le :</strong> ${DATE_SOURCE_ETABLISSEMENTS}.</p>
    <div class="cta-row">
      <a class="button primary" href="${EST_PREFIXE}/?mode=etablissements">Explorer sur la carte interactive</a>
      <a class="button secondary" href="${EST_PREFIXE}/cliniques/">Cliniques de la Montérégie-Est</a>
    </div>
  </section>

  ${htmlBanniereSqb('../../assets')}

  <div class="callout official"><strong>Ce que ces pages disent — et ne disent pas :</strong> un secteur « en recrutement » indique qu’un besoin a été déclaré, sans préjuger du nombre de postes ni des modalités d’exercice. Les coordonnées de recrutement des établissements seront publiées prochainement. <a href="${EST_PREFIXE}/ptem/">Comprendre le PTEM →</a></div>

${sections}`;

  return page({
    titre: 'Secteurs en établissement en Montérégie-Est | Trouve ta clinique',
    description: 'Répertoire des installations de la Montérégie-Est dont un ou plusieurs secteurs d’activité recrutent des médecins de famille : hôpitaux, CHSLD, CLSC, GMF-U et missions régionales.',
    // TODO : remettre indexable: true une fois les 22 fiches établissements publiées (actuellement 3/22). La page reste en ligne et navigable (elle est déjà honnête sur son état — « Trois d'entre elles ont déjà une fiche détaillée ; les autres s'ouvrent sur la carte »), seulement retirée de l'indexation Google jusqu'au lot complet.
    url, profondeur: 2, indexable: false, jsonLd, actif: 'etablissements', univers: u,
    filDAriane: `<a href="${EST_ACCUEIL}">Montérégie-Est</a> › Secteurs en établissement`,
    corps
  });
}

/* Ancien slug INS-018 : « Ste-Philippe » dans le nom produisait …/ste-philippe/. */
const REDIRECTIONS_ETABLISSEMENTS = [
  {
    ancien: 'centre-de-readaptation-en-dependance-ste-philippe',
    nouveau: 'centre-de-readaptation-en-dependance-saint-philippe',
    libelle: 'La fiche du Centre de réadaptation en dépendance Saint-Philippe'
  }
];

function publierPagesEtablissements(slugsCliniques, entrees, majPagesSeo) {
  const donnees = chargerDonneesEtablissements();
  ecrire(path.join('monteregie-est', 'etablissements', 'index.html'),
    pageRepertoireEtablissements(donnees, slugsCliniques, majPagesSeo));
  /* Hors sitemap tant que le répertoire est en noindex (lot 3/22). */
  const conserves = new Set();
  let n = 0;
  for (const id of PREMIER_LOT_ETABLISSEMENTS) {
    const inst = (donnees.installations || []).find(i => i.id === id);
    if (!inst) throw new Error('Installation du premier lot introuvable : ' + id);
    const secteurs = secteursDe(donnees, id);
    const p = pageEtablissement(inst, secteurs, majPagesSeo);
    ecrire(path.join('monteregie-est', 'etablissements', p.slug, 'index.html'), p.html);
    conserves.add(p.slug);
    if (p.indexable) {
      entrees.push({ loc: `${EST_PREFIXE}/etablissements/${p.slug}/`, lastmod: majPagesSeo, changefreq: 'monthly', priority: '0.7' });
    }
    n++;
  }
  for (const r of REDIRECTIONS_ETABLISSEMENTS) {
    const destination = `${SITE}${EST_PREFIXE}/etablissements/${r.nouveau}/`;
    ecrire(path.join('monteregie-est', 'etablissements', r.ancien, 'index.html'),
      pageRedirectionStatique(destination, r.libelle));
    conserves.add(r.ancien);
  }
  const racineEtab = path.join(RACINE, 'monteregie-est', 'etablissements');
  if (fs.existsSync(racineEtab)) {
    for (const nom of fs.readdirSync(racineEtab)) {
      const dossier = path.join(racineEtab, nom);
      if (!fs.lstatSync(dossier).isDirectory()) continue;
      if (conserves.has(nom)) continue;
      fs.rmSync(dossier, { recursive: true, force: true });
    }
  }
  return n;
}

const PAGES_FIXES = [
  { loc: '/', lastmod: null, changefreq: 'weekly', priority: '1.0' },
  { loc: '/monteregie-est/', lastmod: null, changefreq: 'weekly', priority: '0.9' },
  { loc: '/monteregie-est/ptem/', lastmod: '2026-08-31', changefreq: 'weekly', priority: '0.9' },
  { loc: '/monteregie-est/amp/', lastmod: '2026-08-31', changefreq: 'monthly', priority: '0.9' },
  { loc: '/monteregie/', lastmod: null, changefreq: 'monthly', priority: '0.4' },
  /* Cartes Centre/Ouest : indexables et présentes sur l'accueil ; aligner le sitemap (2 sept.). */
  { loc: '/monteregie-centre/', lastmod: null, changefreq: 'monthly', priority: '0.3' },
  { loc: '/monteregie-ouest/', lastmod: null, changefreq: 'monthly', priority: '0.3' }
];

function sitemap(entrees) {
  const urls = entrees.map(e => `  <url>
    <loc>${SITE}${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Généré automatiquement par scripts/generer-pages-seo.js — ne pas modifier à la main. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/* ------------------------------------------------------------------------------------------- */
/* PROGRAMME PRINCIPAL                                                                          */
/* ------------------------------------------------------------------------------------------- */

function ecrire(relatif, contenu) {
  const cible = path.join(RACINE, relatif);
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, contenu, 'utf8');
}

/*
 * Page de redirection statique pour une ancienne adresse dont la page canonique vit désormais
 * dans un univers régional (ou, inversement, pour une copie régionale d'une page générale).
 *
 * GitHub Pages ne permet pas de déclarer des redirections HTTP 301 côté serveur. Cette page
 * combine canonical + noindex, meta refresh, et location.replace() en conservant la query
 * string et le fragment (#ancre) — critique pour /ptem/#… et les liens partagés.
 * Les 301 Cloudflare restent préférables dès qu'ils sont disponibles sans risque.
 */
function pageRedirectionStatique(destination, libelle) {
  const urlHtml = esc(destination);
  const libelleHtml = esc(libelle);
  const destJs = JSON.stringify(String(destination));
  return `<!doctype html>
<html lang="fr-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Page déplacée | Trouve ta clinique</title>
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${urlHtml}">
<meta http-equiv="refresh" content="0; url=${urlHtml}">
<script>(function(){var b=${destJs};var d=b;if(location.search)d+= (d.indexOf("?")>=0?"&":"?")+location.search.slice(1);if(location.hash)d+=location.hash;location.replace(d);})();</script>
</head>
<body>
<p>${libelleHtml} a été déplacée. <a href="${urlHtml}">Continuer vers la nouvelle adresse</a>.</p>
</body>
</html>
`;
}

function publierPagesGuide() {
  for (const nom of ['ptem', 'amp']) {
    const source = path.join(RACINE, 'scripts', 'sources', nom + '.html');
    if (!fs.existsSync(source)) {
      throw new Error(`Source manquante : scripts/sources/${nom}.html — exécuter node scripts/creer-modeles-guide.js une fois.`);
    }
    const html = fs.readFileSync(source, 'utf8').replace(/\{\{ASSETS\}\}/g, '../../assets');
    ecrire(path.join('monteregie-est', nom, 'index.html'), html);
    const libelle = nom === 'ptem' ? 'La page PTEM' : 'La page AMP';
    const redirection = pageRedirectionStatique(`${SITE}/monteregie-est/${nom}/`, libelle);
    ecrire(path.join(nom, 'index.html'), redirection);
    for (const u of UNIVERS_REGIONS) {
      if (u.region === 'Est') continue;
      ecrire(path.join(u.dossier, nom, 'index.html'), redirection);
    }
  }
}

function main() {
  const donnees = JSON.parse(fs.readFileSync(path.join(RACINE, 'data.json'), 'utf8'));
  const majDonnees = donnees.miseAJour || new Date().toISOString().slice(0, 10);

  /* Date du dernier changement de gabarit (texte/CSS des pages, indépendant des données de clinique).
     Une refonte du gabarit modifie aussi le contenu HTML, même si data.json n'a pas changé — le
     sitemap doit donc en tenir compte pour son lastmod. Mettre à jour cette date à la main lors
     d'une prochaine modification des templates ci-dessous. */
  const majGabaritsSeo = '2026-09-03';
  const majPagesSeo = [majDonnees, majGabaritsSeo].sort().at(-1);

  const toutes = donnees.cliniques || [];
  const cliniques = toutes.filter(c =>
    c.visible !== false && c.categorie !== 'etablissement' && rempli(c.nom)
  );
  const etablissements = toutes.filter(c => c.categorie === 'etablissement' && rempli(c.nom));
  const horsPublication = toutes.length - cliniques.length - etablissements.length;

  /* Slugs stables */
  const fichierSlugs = path.join(__dirname, 'slugs.json');
  const slugs = chargerSlugs(fichierSlugs);
  const nouveaux = attribuerSlugs(cliniques, slugs);
  fs.writeFileSync(fichierSlugs, JSON.stringify(slugs, null, 2) + '\n', 'utf8');

  /* Vérification : aucun champ hors liste blanche ne doit exister sans qu'on le sache */
  const champsVus = new Set();
  cliniques.forEach(c => Object.keys(c).forEach(k => champsVus.add(k)));
  const horsListe = [...champsVus].filter(k => !CHAMPS_PUBLICS.includes(k));

  /* Tri : par ville puis par nom, comme la liste existante */
  const ordre = (a, b) => (a.ville || '').localeCompare(b.ville || '', 'fr') ||
                          (a.nom || '').localeCompare(b.nom || '', 'fr');
  cliniques.sort(ordre);

  /* Regroupement par RLS */
  const parRls = new Map();
  for (const c of cliniques) {
    if (!rempli(c.rls)) continue;
    if (!parRls.has(c.rls)) parRls.set(c.rls, []);
    parRls.get(c.rls).push(c);
  }

  /* Territoire de chaque RLS — à établir AVANT toute génération : pageRls, le hub régional et
     le choix des adresses canoniques en dépendent tous. */
  indexerRlsParRegion(cliniques);

  const entrees = PAGES_FIXES.map(p => Object.assign({}, p, { lastmod: p.lastmod || majPagesSeo }));

  /* Pages de cliniques — version générale, puis copie étanche dans l'univers du territoire.
     Une seule des deux entre dans le sitemap : celle qui est indexable (voir pageClinique). */
  let indexables = 0, minces = [], copiesRegionales = 0;
  const dejaMince = new Set();
  const noterMince = c => {
    if (dejaMince.has(c.id)) return;      // une même fiche n'est signalée qu'une fois,
    dejaMince.add(c.id);                  // même si ses deux versions sont trop minces
    minces.push({ nom: c.nom, substance: CHAMPS_SUBSTANCE.filter(k => rempli(c[k])).length });
  };
  for (const c of cliniques) {
    const slug = slugs[String(c.id)];

    const general = pageClinique(c, slug, majDonnees, UNIVERS_GENERAL);
    const uCanon = UNIVERS_PAR_REGION[c.region];
    const generalHtml = uCanon && uCanon.canonique
      ? pageRedirectionStatique(`${SITE}${uCanon.prefixe}/cliniques/${slug}/`, `La fiche de ${c.nom}`)
      : general.html;
    ecrire(path.join('cliniques', slug, 'index.html'), generalHtml);
    if (general.indexable) {
      indexables++;
      entrees.push({ loc: `/cliniques/${slug}/`, lastmod: majPagesSeo, changefreq: 'monthly', priority: '0.7' });
    } else if (general.substance < SEUIL_INDEXATION) {
      noterMince(c);
    }

    const uRegion = UNIVERS_PAR_REGION[c.region];
    if (uRegion) {
      const reg = pageClinique(c, slug, majDonnees, uRegion);
      ecrire(path.join(uRegion.dossier, 'cliniques', slug, 'index.html'), reg.html);
      copiesRegionales++;
      if (reg.indexable) {
        indexables++;
        entrees.push({ loc: `${uRegion.prefixe}/cliniques/${slug}/`, lastmod: majPagesSeo, changefreq: 'monthly', priority: '0.7' });
      } else if (reg.substance < SEUIL_INDEXATION) {
        noterMince(c);
      }
    }
  }

  /* Conserver les anciennes adresses contenant « c-ur » sans laisser en ligne une seconde fiche
     périmée. Si la fiche corrigée est toujours publiée, les deux variantes historiques pointent
     vers son URL canonique. Si elle est maintenant masquée, elles reviennent plutôt au répertoire
     régional afin de ne jamais rediriger vers une page inexistante. */
  const slugsPublies = new Set(cliniques.map(c => slugs[String(c.id)]).filter(Boolean));
  for (const r of REDIRECTIONS_SLUGS_HISTORIQUES) {
    const destination = slugsPublies.has(r.nouveau)
      ? `${SITE}/monteregie-est/cliniques/${r.nouveau}/`
      : `${SITE}/monteregie-est/cliniques/`;
    const redirection = pageRedirectionStatique(destination, r.libelle);
    ecrire(path.join('cliniques', r.ancien, 'index.html'), redirection);
    ecrire(path.join('monteregie-est', 'cliniques', r.ancien, 'index.html'), redirection);
  }

  /* Pages de RLS — même principe. */
  for (const [rls, liste] of parRls) {
    const slug = slugifier(rls);

    const general = pageRls(rls, liste, slugs, majDonnees, UNIVERS_GENERAL);
    const uCanonRls = UNIVERS_PAR_REGION[REGION_DU_RLS[rls]];
    const generalRlsHtml = uCanonRls && uCanonRls.canonique
      ? pageRedirectionStatique(`${SITE}${uCanonRls.prefixe}/rls/${slug}/`, `La page du RLS ${rls}`)
      : general.html;
    ecrire(path.join('rls', slug, 'index.html'), generalRlsHtml);
    if (general.indexable) {
      entrees.push({ loc: `/rls/${slug}/`, lastmod: majPagesSeo, changefreq: 'weekly', priority: '0.8' });
    }

    const uRegion = UNIVERS_PAR_REGION[REGION_DU_RLS[rls]];
    if (uRegion) {
      const reg = pageRls(rls, liste, slugs, majDonnees, uRegion);
      ecrire(path.join(uRegion.dossier, 'rls', slug, 'index.html'), reg.html);
      copiesRegionales++;
      if (reg.indexable) {
        entrees.push({ loc: `${uRegion.prefixe}/rls/${slug}/`, lastmod: majPagesSeo, changefreq: 'weekly', priority: '0.8' });
      }
    }
  }

  /* Copies étanches de /ptem/ et /amp/ : le contenu vit désormais sous /monteregie-est/;
     les anciennes adresses et celles des autres territoires redirigent vers l'Est. */
  publierPagesGuide();

  const nEtabSeo = publierPagesEtablissements(slugs, entrees, majPagesSeo);

  /* Répertoire général + hub RLS de chaque univers régional + sitemap */
  ecrire(path.join('cliniques', 'index.html'),
    pageRedirectionStatique(`${SITE}${EST_PREFIXE}/cliniques/`, 'Cette page du répertoire des cliniques'));
  for (const u of UNIVERS_REGIONS) {
    /* Hub cliniques régional, restreint aux fiches du territoire. Sans lui, Centre et Ouest
       répondaient 404 (29 août 2026). */
    const cliniquesRegion = cliniques.filter(c => c.region === u.region);
    const parRlsRegion = new Map();
    for (const c of cliniquesRegion) {
      if (!c.rls) continue;
      if (!parRlsRegion.has(c.rls)) parRlsRegion.set(c.rls, []);
      parRlsRegion.get(c.rls).push(c);
    }
    ecrire(path.join(u.dossier, 'cliniques', 'index.html'),
           pageRepertoire(cliniquesRegion, slugs, parRlsRegion, majDonnees, u));
    copiesRegionales++;
    if (u.canonique) {
      entrees.push({ loc: `${u.prefixe}/cliniques/`, lastmod: majPagesSeo, changefreq: 'weekly', priority: '0.8' });
    }
    const hub = pageRlsHubRegion(u, parRls, majDonnees);
    ecrire(path.join(u.dossier, 'rls', 'index.html'), hub);
    copiesRegionales++;
    if (u.canonique) {
      entrees.push({ loc: `${u.prefixe}/rls/`, lastmod: majPagesSeo, changefreq: 'weekly', priority: '0.8' });
    }
  }
  /* PURGE DES DOSSIERS ORPHELINS (29 août 2026)
     Le générateur ignore les fiches visible:false, mais ne supprimait pas les dossiers créés
     par une génération antérieure. Résultat constaté : /monteregie-est/cliniques/
     clsc-simonne-monet-chartrand/ et clsc-longueuil-ouest/ restaient en « index,follow » et
     affirmaient que le milieu recrutait, alors que les fiches sont masquées.
     On supprime maintenant le dossier orphelin du dépôt. Chaque racine possède sa propre liste
     de fiches attendues : une clinique d'un autre territoire ne doit pas survivre dans un hub
     régional. Seules les redirections historiques explicites sont conservées. */
  {
    const slugsHistoriques = REDIRECTIONS_SLUGS_HISTORIQUES.map(r => r.ancien);
    const racines = [
      {
        relatif: 'cliniques',
        attendus: new Set(cliniques.map(c => slugs[String(c.id)]).filter(Boolean)),
        conserves: new Set(slugsHistoriques)
      },
      ...UNIVERS_REGIONS.map(u => ({
        relatif: path.join(u.dossier, 'cliniques'),
        attendus: new Set(cliniques.filter(c => c.region === u.region)
          .map(c => slugs[String(c.id)]).filter(Boolean)),
        conserves: new Set(u.region === 'Est' ? slugsHistoriques : [])
      }))
    ];
    let purges = 0;
    for (const racine of racines) {
      const abs = path.join(RACINE, racine.relatif);
      if (!fs.existsSync(abs)) continue;
      for (const nom of fs.readdirSync(abs)) {
        const dossier = path.join(abs, nom);
        if (!fs.lstatSync(dossier).isDirectory()) continue;
        if (racine.attendus.has(nom) || racine.conserves.has(nom)) continue;
        fs.rmSync(dossier, { recursive: true, force: true });
        purges++;
      }
    }
    if (purges) console.log(`Dossiers orphelins supprimés : ${purges}`);
  }

  /* Page d'accueil à la racine. La carte complète est fabriquée par publier-regions.js dans
     /monteregie/ au cours de la même génération : la bascule reste atomique. `toutes` (pas
     `cliniques`) parce que le compte inclut aussi la couche Établissements. */
  const accueil = pageAccueil(toutes, majDonnees);
  ecrire('index.html', accueil.html);

  ecrire('sitemap.xml', sitemap(entrees));

  /* Rapport */
  console.log('=== GÉNÉRATION DES PAGES SEO ===');
  console.log(`data.json du ${majDonnees} — ${toutes.length} fiches source : ${cliniques.length} cliniques publiées (${cliniques.filter(recrute).length} en recrutement, ${cliniques.filter(c => !recrute(c)).length} hors recrutement), ${etablissements.length} établissements dans la couche cartographique${horsPublication ? `, ${horsPublication} fiche(s) hors publication` : ''}`);
  console.log(`Pages de cliniques : ${cliniques.length} générées, ${indexables} indexables, ${minces.length} en noindex (moins de ${SEUIL_INDEXATION} champs remplis)`);
  console.log(`Pages de RLS       : ${parRls.size}`);
  console.log(`Répertoire         : cliniques/index.html`);
  console.log(`Établissements     : répertoire + ${nEtabSeo} fiche(s) (premier lot)`);
  console.log(`Sitemap            : ${entrees.length} URL`);
  console.log(`Courriels publiés  : ${PUBLIER_COURRIELS ? 'OUI (décision du 2 sept. 2026)' : 'non'}`);
  if (nouveaux.length) {
    console.log(`\nNouveaux slugs attribués (${nouveaux.length}) — désormais figés :`);
    nouveaux.forEach(n => console.log(`  id ${n.id} → /cliniques/${n.slug}/   (${n.nom})`));
  } else {
    console.log('\nAucun nouveau slug : toutes les URL existantes sont conservées telles quelles.');
  }
  if (minces.length) {
    console.log(`\nFiches trop minces pour l'indexation (page créée, mais noindex + hors sitemap) :`);
    minces.forEach(m => console.log(`  ${m.substance} champs — ${m.nom}`));
    console.log(`  → elles redeviendront indexables toutes seules dès qu'elles atteindront ${SEUIL_INDEXATION} champs dans data.json.`);
  }
  if (horsListe.length) {
    console.log(`\nChamps de data.json NON publiés (hors liste blanche, normal) : ${horsListe.join(', ')}`);
  }
}

main();
