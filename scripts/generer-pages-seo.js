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

/*
 * Bouton hamburger du header. Défini une seule fois pour que le gabarit page() et la
 * normalisation des pages guide (PTEM/AMP, publiées depuis un instantané figé dans
 * scripts/sources/) produisent exactement le même balisage — donc le même CSS.
 */
const NAV_TOGGLE_BOUTON = `<button type="button" class="nav-toggle" id="nav-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Ouvrir le menu">
      <span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span>
    </button>`;

const NAV_TOGGLE_SCRIPT = `<script>
(function () {
  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;
  function fermer() {
    toggle.setAttribute('aria-expanded', 'false');
    nav.removeAttribute('data-open');
  }
  toggle.addEventListener('click', function () {
    var ouvert = toggle.getAttribute('aria-expanded') === 'true';
    if (ouvert) { fermer(); } else {
      toggle.setAttribute('aria-expanded', 'true');
      nav.setAttribute('data-open', 'true');
    }
  });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) fermer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });
  document.addEventListener('click', function (e) {
    if (!nav.contains(e.target) && !toggle.contains(e.target)) fermer();
  });
})();
</script>`;

/* Migration v52 : l'ancienne application générale enregistrait un service worker de portée
   « / ». La PWA étant désormais réservée à Montérégie-Est, toutes les pages de contenu retirent
   cette ancienne inscription si elle existe. La PWA Est, de portée /monteregie-est/, est
   conservée. */
/*
 * Ménage des anciens service workers de portée « / ».
 *
 * 4 septembre 2026 — la désinscription seule ne suffisait pas. Un ancien service worker
 * enregistré à la racine contrôle encore la page au moment où le script s'exécute : il a
 * déjà répondu à la navigation depuis son cache, donc le visiteur qui tape
 * trouvetaclinique.ca voyait l'ancienne page d'accueil. La désinscription ne prenait effet
 * qu'à la navigation suivante — d'où « je clique ailleurs, je reviens, et là c'est la
 * bonne page ». On ajoute donc deux choses : la purge des caches hérités (ptem-2027-*),
 * que unregister() ne supprime pas, et un rechargement unique quand on a effectivement
 * retiré un service worker racine qui contrôlait la page.
 *
 * Pas de boucle possible : après le rechargement il n'y a plus d'enregistrement racine à
 * retirer, la condition est donc fausse et le script s'arrête tout seul.
 * Les pages sous /monteregie-est/ sont exclues du rechargement : elles sont légitimement
 * contrôlées par le service worker de la PWA Est, dont la portée n'est pas « / ».
 */
const SERVICE_WORKER_CLEANUP = `<script>
(function () {
  if (!('serviceWorker' in navigator)) return;
  var horsEst = location.pathname.indexOf('/monteregie-est/') !== 0;
  var controlee = !!navigator.serviceWorker.controller;
  var taches = [];

  if (navigator.serviceWorker.getRegistrations) {
    taches.push(navigator.serviceWorker.getRegistrations().then(function (enregistrements) {
      return Promise.all(enregistrements.map(function (enr) {
        var racine = false;
        try { racine = new URL(enr.scope).pathname === '/'; } catch (e) {}
        if (!racine) return false;
        return enr.unregister().then(function () { return true; }, function () { return false; });
      }));
    }).then(function (faits) {
      return faits.indexOf(true) !== -1;
    }, function () { return false; }));
  }

  if (window.caches && caches.keys) {
    taches.push(caches.keys().then(function (noms) {
      return Promise.all(noms.filter(function (n) {
        return n.indexOf('ptem-2027-') === 0;
      }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return false; }, function () { return false; }));
  }

  Promise.all(taches).then(function (resultats) {
    if (resultats.indexOf(true) === -1) return;
    if (!horsEst || !controlee) return;
    var deja = false;
    try {
      deja = sessionStorage.getItem('ttc-sw-purge') === '1';
      sessionStorage.setItem('ttc-sw-purge', '1');
    } catch (e) {}
    if (!deja) location.reload();
  });
})();
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
 * JSON-LD JobPosting sur les fiches (cliniques et GMF-U). Coupé le 4 septembre 2026 :
 * Search Console refuse hiringOrganization en MedicalOrganization, et les extraits
 * « offre d’emploi » ne sont pas encore le but. La fonction jsonLdJobPosting reste ;
 * repasser à true pour republier les balises, après '@type': 'Organization'.
 * Les annonces de la carte (data.json → annonce) ne passent pas par ici.
 */
const PUBLIER_JOB_POSTING = false;

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

/* Titles / meta : Google coupe vers 60 / 155–160 caractères. Le nom du site est déjà
   fourni par og:site_name — on ne le répète plus dans <title>. */
function limiterTexte(s, max) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const coupe = t.slice(0, max - 1);
  const espace = coupe.lastIndexOf(' ');
  return ((espace > max * 0.55 ? coupe.slice(0, espace) : coupe).replace(/[ ,;:–—-]+$/, '') + '…');
}

function listeFr(items) {
  const vals = (items || []).map(x => String(x).trim()).filter(Boolean);
  if (vals.length === 0) return '';
  if (vals.length === 1) return vals[0];
  if (vals.length === 2) return vals[0] + ' et ' + vals[1];
  return vals.slice(0, -1).join(', ') + ' et ' + vals[vals.length - 1];
}

function articleIndefini(type) {
  const t = String(type || '').trim();
  if (!t) return 'un';
  if (/^(h[oô]pital|gmf|clsc|chsld|centre)\b/i.test(t) || /^gmf/i.test(t)) return 'un';
  if (/^[aeiouéèêàâîïôùûh]/i.test(t) && !/^un\b/i.test(t)) return "un";
  if (/^(clinique|coopérative|coop)/i.test(t)) return 'une';
  return 'un';
}

/* Paragraphe unique dérivé uniquement des champs déjà publics. Ne compte PAS dans
   SEUIL_INDEXATION : on n’indexe pas une fiche mince en recyclant les 3 champs déjà là. */
function presentationDepuisDonnees(c) {
  if (rempli(c.presentation)) return String(c.presentation).trim();
  const type = rempli(c.type) ? c.type : 'milieu de pratique';
  const ville = rempli(c.ville) ? c.ville : 'la Montérégie';
  const rls = rempli(c.rls) ? ` dans le RLS ${c.rls}` : '';
  const territoire = rempli(c.region) ? ` (Montérégie-${c.region})` : '';
  const phrases = [];
  if (recrute(c)) {
    phrases.push(`${c.nom} est ${articleIndefini(type)} ${type} situé à ${ville}${rls}${territoire}. Le milieu recrute actuellement des médecins de famille.`);
  } else {
    phrases.push(`${c.nom} est ${articleIndefini(type)} ${type} situé à ${ville}${rls}${territoire}. Il figure au répertoire à titre de référence et ne recrute pas de médecin de famille pour le moment.`);
  }
  const pratiques = Array.isArray(c.pratiques) ? c.pratiques.map(p => PRATIQUES[p] || p).filter(Boolean) : [];
  if (pratiques.length) {
    phrases.push(`Les pratiques indiquées comprennent ${listeFr(pratiques)}.`);
  }
  if (rempli(c.dme)) phrases.push(`Le dossier médical électronique utilisé est ${c.dme}.`);
  if (rempli(c.horaire)) {
    const ouverts = JOURS.filter(j => rempli(c.horaire[j]) && !/^ferm/i.test(String(c.horaire[j])));
    if (ouverts.length) phrases.push(`Des heures d’ouverture sont publiées pour ${listeFr(ouverts)}.`);
  }
  if (rempli(c.personnel)) {
    const postes = Object.keys(PERSONNEL).filter(k => rempli(c.personnel[k]));
    if (postes.length) {
      phrases.push(`L’équipe déclarée compte notamment ${listeFr(postes.map(k => PERSONNEL[k]))}.`);
    }
  }
  if (String(c.type || '').toUpperCase() === 'GMF-U') {
    phrases.push('Comme tout GMF-U, un recrutement suppose l’aval du directeur du département universitaire de médecine familiale concerné.');
  }
  return phrases.join(' ');
}

function titreClinique(c) {
  const base = rempli(c.ville) ? `${c.nom} — ${c.ville}` : String(c.nom || '');
  return limiterTexte(base, 58);
}

function descriptionClinique(c) {
  const type = rempli(c.type) ? c.type : 'milieu';
  const ville = rempli(c.ville) ? c.ville : 'Montérégie';
  const rls = rempli(c.rls) ? ` (RLS ${c.rls})` : '';
  const extra = [];
  if (Array.isArray(c.pratiques) && c.pratiques.length) extra.push('pratiques');
  if (rempli(c.dme)) extra.push('DMÉ');
  if (rempli(c.horaire)) extra.push('horaires');
  const queue = extra.length ? ` : ${listeFr(extra)}.` : '.';
  const corps = recrute(c)
    ? `${c.nom}, ${type} à ${ville}${rls}, recrute des médecins de famille${queue}`
    : `${c.nom}, ${type} à ${ville}${rls}, ne recrute pas actuellement${queue}`;
  return limiterTexte(corps, 155);
}

/* Image de partage 1200×630 (pas la bannière Est 1024×341). */
const OG_PARTAGE = {
  url: `${SITE}/assets/og-image-accueil.png`,
  largeur: '1200',
  hauteur: '630',
  alt: 'Trouve ta clinique — cliniques et établissements en recrutement en Montérégie.'
};

/* GMF-U qui ont aussi une fiche établissement : une seule URL indexable (l’établissement).
   Rempli dans main() avant la génération. Clé = id clinique (string) → slug établissement. */
let HREF_GMFU_ETABLISSEMENT = {};

function indexerGmfuCanoniques() {
  const donnees = chargerDonneesEtablissements();
  const lot = new Set(PREMIER_LOT_ETABLISSEMENTS);
  const map = {};
  for (const inst of donnees.installations || []) {
    if (inst.type !== 'gmf-u' || !lot.has(inst.id)) continue;
    const ref = inst.referenceExistante;
    if (ref && ref.collection === 'cliniques' && ref.id != null) {
      map[String(ref.id)] = slugEtablissement(inst);
    }
  }
  HREF_GMFU_ETABLISSEMENT = map;
}

function hrefFicheMilieu(c, slug, prefixe) {
  const etab = HREF_GMFU_ETABLISSEMENT[String(c.id)];
  if (etab) return `${EST_PREFIXE}/etablissements/${etab}/`;
  return `${prefixe}/cliniques/${slug}/`;
}

function jsonLdJobPosting(c, url, majDonnees) {
  if (!PUBLIER_JOB_POSTING) return null;
  if (!recrute(c)) return null;
  return {
    '@type': 'JobPosting',
    title: 'Médecin de famille',
    description: presentationDepuisDonnees(c),
    datePosted: majDonnees,
    validThrough: '2027-11-30',
    employmentType: 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: c.nom,
      url
    },
    jobLocation: {
      '@type': 'Place',
      address: Object.assign({ '@type': 'PostalAddress' }, decouperAdresse(c.adresse, c.ville))
    },
    url,
    identifier: { '@type': 'PropertyValue', name: 'Trouve ta clinique', value: String(c.id) }
  };
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
 * réponse au besoin exprimé par Santé Québec Montérégie-Est. Une personne qui entre par
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

/* Bannière « cellulaire » (desktop uniquement) : sur les 4 pages Montérégie-Est où le
   contexte est sans ambiguïté (établissements, cliniques, PTEM, AMP), on montre le mockup
   téléphone à partir de BANNIERE_EST_DESKTOP_SEUIL px. En dessous — mobile — on garde la
   bannière pâle existante, plus lisible à petite taille. Ne jamais utiliser cette variante
   sur les pages Centre/Ouest : le mockup affiche la carte de l'Est. */
const BANNIERE_EST_DESKTOP_FICHIER = 'banniere-cellulaire-monteregie-est.jpg';
const BANNIERE_EST_DESKTOP_SEUIL = 701;

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

/* Navigation : carte et cliniques suivent le territoire de la page. PTEM/AMP restent
   les guides canoniques de l’Est (les copies Centre/Ouest ne sont que des redirections).
   Le répertoire établissements n’existe qu’en Montérégie-Est. */
function liensNav(u) {
  const prefixe = (u && u.regional) ? u.prefixe : EST_PREFIXE;
  const carte = (u && u.regional) ? u.accueil : EST_ACCUEIL;
  const liens = [
    ['/', 'Accueil', 'accueil'],
    [carte, 'Carte interactive', 'carte'],
    [prefixe + '/cliniques/', 'Cliniques', 'cliniques']
  ];
  if (!u || !u.regional || u.region === 'Est') {
    liens.push([EST_PREFIXE + '/etablissements/', 'Établissements', 'etablissements']);
  }
  liens.push(
    [EST_PREFIXE + '/ptem/', 'PTEM', 'ptem'],
    [EST_PREFIXE + '/amp/', 'AMP', 'amp']
  );
  return liens;
}

function htmlBanniereSqb(assetsChemin, { compact = true, estActif = false } = {}) {
  const wrap = compact ? 'sqb-wrap compact directory-banner' : 'sqb-wrap';
  const img = `${assetsChemin}/${BANNIERE_EST_FICHIER}`;
  const alt = 'Carte interactive Trouve ta clinique — Montérégie-Est';
  const imgFallback = `<img src="${img}" alt="${alt}" width="${BANNIERE_EST_LARGEUR}" height="${BANNIERE_EST_HAUTEUR}" decoding="sync" loading="lazy">`;
  if (!estActif) {
    return `<figure class="${wrap}"><a class="sqb-photo" href="${EST_ACCUEIL}" aria-label="Ouvrir la carte interactive Montérégie-Est"><img src="${img}" srcset="${img} ${BANNIERE_EST_LARGEUR}w" sizes="(max-width: ${BANNIERE_EST_LARGEUR}px) 100vw, ${BANNIERE_EST_LARGEUR}px" alt="${alt}" width="${BANNIERE_EST_LARGEUR}" height="${BANNIERE_EST_HAUTEUR}" decoding="sync" loading="lazy"></a></figure>`;
  }
  const imgDesktop = `${assetsChemin}/${BANNIERE_EST_DESKTOP_FICHIER}`;
  return `<figure class="${wrap}"><a class="sqb-photo" href="${EST_ACCUEIL}" aria-label="Ouvrir la carte interactive Montérégie-Est"><picture><source media="(min-width: ${BANNIERE_EST_DESKTOP_SEUIL}px)" srcset="${imgDesktop}">${imgFallback}</picture></a></figure>`;
}

function page({ titre, description, url, profondeur, indexable = true, canonical, jsonLd,
                filDAriane, corps, actif, univers = UNIVERS_GENERAL, ogImageOverride = null,
                verification = false }) {
  const u = univers;
  /* Feuille de style : chemin relatif dans l'univers général (comme avant), absolu dans
     l'univers Est, dont les pages ne vivent pas toutes à la même profondeur. */
  const cssHref = u.regional ? '/assets/seo-pages.css'
                        : profondeur === 0 ? '/assets/seo-pages.css'
                        : (profondeur === 1 ? '../' : '../../') + 'assets/seo-pages.css';
  const robots = indexable
    ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
    : 'noindex,follow';
  const ogImage = ogImageOverride
    ? `${SITE}/assets/${ogImageOverride.fichier}`
    : OG_PARTAGE.url;
  const ogImageW = ogImageOverride ? ogImageOverride.largeur : OG_PARTAGE.largeur;
  const ogImageH = ogImageOverride ? ogImageOverride.hauteur : OG_PARTAGE.hauteur;
  const ogImageAlt = ogImageOverride ? ogImageOverride.alt : OG_PARTAGE.alt;
  const liens = liensNav(u);
  const nav = liens.map(([href, txt, cle]) =>
    `      <a href="${href}"${actif === cle ? ' aria-current="page"' : ''}>${txt}</a>`).join('\n');
  const metaVerification = verification
    ? '  <meta name="google-site-verification" content="-8EkDVTZKsywxr7fJMd3kZIMVaUedo7eU9ThFutr8dY" />\n'
    : '';

  return `<!doctype html>
<html lang="fr-CA">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titre)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical || url)}">
  <meta name="robots" content="${robots}">
${metaVerification}  <meta property="og:locale" content="fr_CA">
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
    ${NAV_TOGGLE_BOUTON}
    <nav class="nav" id="site-nav" aria-label="Navigation principale">
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
${NAV_TOGGLE_SCRIPT}
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
    ? `<a href="${esc(c.site)}" rel="noopener" target="_blank">${esc(c.site)}</a>` : '');
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

  /* --- Texte du milieu : champ libre, sinon paragraphe dérivé des champs publics --- */
  const textePresentation = presentationDepuisDonnees(c);
  let blocTexte = `
  <section id="presentation">
    <h2>Présentation du milieu</h2>
    <p>${esc(textePresentation)}</p>
${rempli(c.infos) ? '    <p>' + esc(c.infos) + '</p>' : ''}
  </section>`;

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

  const job = jsonLdJobPosting(c, url, majDonnees);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': url + '#webpage',
        url: url,
        name: titreClinique(c),
        inLanguage: 'fr-CA',
        dateModified: majDonnees,
        isPartOf: { '@id': SITE + '/#website' },
        about: { '@id': url + '#clinique' }
      },
      clinique,
      ...(job ? [job] : []),
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
    <p class="lead">${esc(textePresentation)}</p>
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
      <li><a href="${EST_PREFIXE}/ptem/">Comprendre le PTEM et l’avis de conformité</a></li>
      <li><a href="${EST_PREFIXE}/amp/">Comprendre les activités médicales particulières (AMP)</a></li>
      <li><a href="${u.accueil}?c=${c.id}">Fiche complète et itinéraire sur la carte interactive</a></li>
    </ul>
  </section>`;

  return {
    html: page({
      titre: titreClinique(c),
      description: descriptionClinique(c),
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
        <a href="${hrefFicheMilieu(c, slugs[String(c.id)], u.prefixe)}"><strong>${esc(c.nom)}</strong></a>${badgeVerif(c)}
        <span class="rep-meta">${esc(c.ville)} · ${esc(c.type)}${rempli(c.dme) ? ' · DMÉ ' + esc(c.dme) : ''}${recrute(c) ? '' : ' · Ne recrute pas actuellement'}</span>
      </li>`;
  const items = actifs.map(item).join('\n');
  const itemsInactifs = inactifs.map(item).join('\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': url + '#webpage', url,
        name: `Cliniques en recrutement — RLS ${rls}`,
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
        ? `<a class="button secondary" href="${EST_PREFIXE}/ptem/">Comprendre le PTEM</a>`
        : `<a class="button secondary" href="${EST_PREFIXE}/cliniques/">Toutes les cliniques</a>`}
      ${(!u.regional && uRegion)
        ? `<a class="button secondary" href="${uRegion.accueil}">${esc(uRegion.nom)}</a>` : ''}
    </div>
  </section>

  <div class="callout official"><strong>Pourquoi le RLS compte :</strong> l’avis de conformité PTEM précise la région ou le sous-territoire où le médecin doit réaliser au moins 55 % de ses jours de facturation. Le choix du RLS se fait donc en même temps que celui du milieu. <a href="${EST_PREFIXE}/ptem/">Comprendre le PTEM →</a> <a class="source-chip" href="https://www.quebec.ca/gouvernement/travailler-gouvernement/sante-services-sociaux/travailler-comme-medecin-famille-quebec/plans-regionaux-effectifs-medicaux-medecine-famille" rel="noopener">Source officielle</a></div>

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
    titre: limiterTexte(`Cliniques en recrutement — RLS ${rls}`, 58),
    description: limiterTexte(
      inactifs.length
        ? `${actifs.length} milieux en recrutement dans le RLS ${rls} (${villesActifs.slice(0, 3).join(', ')}), plus ${inactifs.length} publié${inactifs.length > 1 ? 's' : ''} à titre de référence.`
        : `${actifs.length} milieux en recrutement dans le RLS ${rls} (${villesActifs.slice(0, 4).join(', ')}). Fiches, pratiques et coordonnées.`,
      155
    ),
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
        name: `RLS de la ${u.nom}`,
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
      <a class="button secondary" href="${EST_PREFIXE}/ptem/">Comprendre le PTEM</a>
    </div>
  </section>

${sections}`;

  return page({
    titre: limiterTexte(`RLS de la ${u.nom}`, 58),
    description: limiterTexte(`Les ${rlsPresents.length} RLS de la ${u.nom} et leurs milieux en recrutement de médecins de famille.`, 155),
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
    ['Champlain', '/monteregie-centre/rls/champlain/'],
    ['Haut-Richelieu–Rouville', '/monteregie-centre/rls/haut-richelieu-rouville/'],
    ['Jardins-Roussillon', '/monteregie-ouest/rls/jardins-roussillon/'],
    ['Vaudreuil-Soulanges', '/monteregie-ouest/rls/vaudreuil-soulanges/'],
    ['du Suroît', '/monteregie-ouest/rls/du-suroit/'],
    ['du Haut-Saint-Laurent', '/monteregie-ouest/rls/du-haut-saint-laurent/']
  ];
  const rlsEstHtml = RLS_EST.map(nom =>
    `      <a href="/monteregie-est/rls/${slugifier(nom)}/">${esc(nom)}</a>`).join('\n');
  const rlsAutresHtml = RLS_AUTRES.map(([nom, href]) =>
    `      <a href="${href}">${esc(nom)}</a>`).join('\n');

  const url = `${SITE}/`;
  const titre = 'Cliniques qui recrutent en médecine familiale — Montérégie';
  const description = limiterTexte(
    'Carte des cliniques et établissements de la Montérégie : coordonnées, horaires et contacts pour préparer votre PTEM en médecine familiale.',
    155
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${url}#organisation`,
        name: 'Trouve ta clinique',
        url,
        logo: `${SITE}/apple-touch-icon-180.png`,
        founder: { '@id': `${url}#auteur` }
      },
      {
        '@type': 'WebSite', '@id': `${url}#website`, name: 'Trouve ta clinique', url,
        inLanguage: 'fr-CA', description,
        publisher: { '@id': `${url}#organisation` }
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
<h3 class="soustitre">Autres territoires de la Montérégie</h3>
<p class="terr-autres-note">Les cartes Centre et Ouest sont publiées. La Montérégie-Est reste le territoire le plus complet (cliniques, établissements, PTEM et AMP).</p>
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

<details class="apropos-discret">
  <summary>D'où viennent ces informations</summary>
  <p>Ce projet est développé et tenu à jour par un résident en médecine familiale, avec la
     collaboration du Recrutement médical de Santé Québec - Montérégie-Est. Les fiches
     sont constituées à partir des renseignements transmis par les cliniques elles-mêmes,
     complétés par des sources publiques et vérifiés manuellement.</p>
  <p>Initiative bénévole, indépendante et sans but lucratif. Elle ne remplace aucune démarche
     officielle. Une erreur ou une information à corriger ? Les signalements sont bienvenus.</p>
  <p class="maj">Données mises à jour le <time datetime="${esc(majDonnees)}">${esc(dateLisibleFr(majDonnees))}</time>.</p>
</details>
`;

  const html = page({
    titre, description, url, profondeur: 0, indexable: true, canonical: url, jsonLd,
    filDAriane: '', corps, actif: 'accueil', univers: UNIVERS_GENERAL, verification: true
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
        <a href="${hrefFicheMilieu(c, slugs[String(c.id)], prefixe)}"><strong>${esc(c.nom)}</strong></a>${badgeVerif(c)}
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
        name: `Cliniques en recrutement en ${nomTerritoire}`,
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
      <a class="button secondary" href="${EST_PREFIXE}/ptem/">Guide PTEM</a>
    </div>
  </section>

  ${u ? '' : `<section id="territoires">
    <h2>Explorer par territoire</h2>
    <ul class="repertoire">
${UNIVERS_REGIONS.map(v => `      <li><a href="${v.accueil}"><strong>${esc(v.nom)}</strong></a>
        <span class="rep-meta">${v.ordreRls.length} RLS · ${esc(v.ordreRls.join(', '))}</span></li>`).join('\n')}
    </ul>
  </section>`}

  ${htmlBanniereSqb(u ? '../../assets' : '../assets', { estActif: Boolean(u && u.region === 'Est') })}

  <div class="callout official"><strong>Comment choisir :</strong> le RLS peut être déterminant pour l’avis de conformité PTEM, qui exige au moins 55 % des jours de facturation dans le territoire visé. Le type de milieu (GMF, GMF-U, CLSC…), le DMÉ, les frais de bureau et les pratiques offertes aident ensuite à comparer le quotidien de pratique. <a class="source-chip" href="https://www.quebec.ca/gouvernement/travailler-gouvernement/sante-services-sociaux/travailler-comme-medecin-famille-quebec/plans-regionaux-effectifs-medicaux-medecine-famille" rel="noopener">Source officielle</a></div>

${sections}`;

  return page({
    titre: limiterTexte(`Cliniques en recrutement en ${nomTerritoire}`, 58),
    description: limiterTexte(`Répertoire des ${cliniques.length} milieux publiés en ${nomTerritoire} (dont ${enRecrutementTotal} en recrutement), classés par ${parRls.size} RLS.`, 155),
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
 * aucun ETC, aucun nom ni courriel de responsable.
 * JSON-LD : pas de contactPoint. JobPosting uniquement si PUBLIER_JOB_POSTING et une fiche
 * clinique liée recrute (éteint le 4 sept. 2026, générateur conservé).
 * Le nom de la personne-ressource SQ n'apparaît dans aucun fichier du dépôt
 * (garde-fou du secret NOM_PROTEGE_SANTE_QUEBEC).
 */
const DATE_SOURCE_ETABLISSEMENTS = '2026-08-28';
/* Les 22 installations ont maintenant une description propre, rédigée à partir de leur page
   officielle (voir DESCRIPTIONS_ETABLISSEMENTS plus bas) : le lot couvre donc tout le relevé. */
const PREMIER_LOT_ETABLISSEMENTS = [
  'INS-001', 'INS-002', 'INS-003', 'INS-004', 'INS-005', 'INS-006', 'INS-007', 'INS-008',
  'INS-009', 'INS-010', 'INS-011', 'INS-012', 'INS-013', 'INS-014', 'INS-015', 'INS-016',
  'INS-017', 'INS-018', 'INS-019', 'INS-020', 'INS-021', 'INS-022'
];
const GMFU_CONDITION_SEO = 'Recrutements en GMF-U : la candidature doit avoir obtenu l’aval du directeur du département universitaire de médecine familiale de la faculté de médecine concernée. Le médecin devra avoir le profil attendu en termes de tâches liées à des fonctions académiques et en termes d’inscription de patients.';
const NOTE_SOURCE_ETABLISSEMENTS = 'les secteurs en recrutement présentés sur cette page proviennent du relevé des besoins en effectifs médicaux 2027 de Santé Québec Montérégie-Est, transmis le 28 août 2026. Ils indiquent qu’un recrutement est en cours dans le secteur, sans préjuger du nombre de postes, de leur répartition ni des modalités d’exercice, qui se précisent avec le milieu. Ces renseignements peuvent évoluer; pour le PTEM et les AMP, les sources officielles et le DTMF priment.';
const CALLOUT_CONTACT_ETABLISSEMENT = '<div class="callout"><strong>Pour joindre ce milieu au sujet du recrutement :</strong> adressez-vous au service de recrutement médical de Santé Québec Montérégie-Est. Les coordonnées nominatives des établissements ne sont pas publiées sur ces fiches.</div>';

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

function typeEnPhrase(typeLib) {
  if (['GMF-U', 'CLSC', 'CHSLD'].includes(typeLib)) return typeLib;
  return String(typeLib || '').toLowerCase();
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

/*
 * Textes de secteur propres à une installation, pour les milieux où la source officielle
 * dit quelque chose de précis sur ce secteur. Ailleurs, le texte générique par catégorie
 * plus bas suffit — mieux vaut un texte générique exact qu'un texte propre inventé.
 */
const PARAGRAPHES_SECTEUR_PAR_INSTALLATION = {
  'INS-012': {
    urgence: '<p>Le service d’urgence de l’Hôtel-Dieu de Sorel dessert la population du RLS Pierre-De Saurel. Le secteur est en recrutement.</p>',
    hospitalisation: '<p>La prise en charge des patients hospitalisés est en recrutement. Cette pratique se combine fréquemment à d’autres secteurs du même établissement.</p>',
    ucdg: '<p>L’unité de courte durée gériatrique accueille des personnes âgées en perte d’autonomie pour une évaluation et une réadaptation de courte durée. Le secteur est en recrutement.</p>',
    obstetrique: '<p>Le secteur d’obstétrique est en recrutement. L’Hôtel-Dieu de Sorel est le seul établissement du RLS Pierre-De Saurel offrant ce service.</p>',
    'soins-intensifs': '<p>Les soins intensifs de l’Hôtel-Dieu de Sorel forment une unité de six lits ou moins. Le secteur est en recrutement.</p>'
  },
  'INS-001': {
    urgence: '<p>Le service d’urgence de l’Hôpital Pierre-Boucher est ouvert 24 heures sur 24. Le secteur est en recrutement.</p>',
    hospitalisation: '<p>L’Hôpital Pierre-Boucher accueille des usagers pour des séjours de courte durée en médecine, chirurgie, soins intensifs, natalité, santé mentale et gériatrie active. La prise en charge des patients hospitalisés est en recrutement.</p>',
    ucdg: '<p>L’unité de courte durée gériatrique accueille des personnes âgées en perte d’autonomie pour une évaluation et une réadaptation de courte durée. Le secteur est en recrutement.</p>',
    'soins-intensifs': '<p>Les soins intensifs font partie des séjours de courte durée offerts par l’Hôpital Pierre-Boucher. Le secteur est en recrutement.</p>'
  },
  'INS-006': {
    urgence: '<p>Le service d’urgence de l’Hôpital Honoré-Mercier est ouvert 24 heures sur 24. Santé Québec Montérégie-Est le décrit comme reconnu pour le traitement des patients ayant des problèmes cardiaques et de ceux dont les problèmes de santé sont liés au vieillissement et à la santé mentale. Le secteur est en recrutement.</p>',
    hospitalisation: '<p>La prise en charge des patients hospitalisés est en recrutement. L’Hôpital Honoré-Mercier est également un centre de niveau secondaire en traumatologie.</p>',
    ucdg: '<p>L’unité de courte durée gériatrique accueille des personnes âgées en perte d’autonomie pour une évaluation et une réadaptation de courte durée. Le secteur est en recrutement.</p>'
  },
  /* Les deux CRD ci-dessous ont déjà la description des services dans leur chapeau : le texte
     de secteur porte donc sur le recrutement lui-même, pas sur une répétition de l'offre. */
  'INS-017': {
    dependance: '<p>Le secteur de réadaptation en dépendance est en recrutement pour le cycle 2027. Les modalités d’exercice se précisent avec le milieu.</p>'
  },
  'INS-019': {
    dependance: '<p>Le secteur de réadaptation en dépendance est en recrutement pour le cycle 2027. Les modalités d’exercice se précisent avec le milieu.</p>'
  }
};

function paragraphesSecteur(s, inst) {
  const propres = PARAGRAPHES_SECTEUR_PAR_INSTALLATION[inst.id];
  if (propres && propres[s.ancre]) return propres[s.ancre];
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
  } else if (s.categorieActivite === 'detention') {
    extra.push('<p>Le secteur de médecine en établissement de détention est en recrutement pour le cycle 2027. Les modalités d’exercice se précisent avec le milieu.</p>');
  } else if (s.categorieActivite === 'gmf-u') {
    extra.push(`<p>Le secteur GMF-U est en recrutement.</p><p>${esc(GMFU_CONDITION_SEO)}</p>`);
  } else {
    extra.push(`<p>Le secteur ${esc(s.libelle)} est en recrutement pour le cycle 2027.</p>`);
  }
  if (s.regroupe) {
    extra.push('<p>Le besoin est regroupé : les modalités se précisent avec le milieu.</p>');
  }
  if (inst.id === 'INS-018') {
    extra.push('<p>Ce site relève de la Montérégie-Ouest. Il est présenté ici comme mission régionale de Santé Québec Montérégie-Est, et non comme un RLS « Régional » — ce territoire n’existe pas.</p>');
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

/*
 * Description propre à chaque installation, rédigée à partir de sa page officielle sur
 * santemonteregie.qc.ca (consultées le 4 septembre 2026), sauf INS-016 (établissement de
 * détention), documenté à partir de quebec.ca — ministère de la Sécurité publique.
 * Règle : rien ici ne doit dépasser ce que la source officielle affirme. Pas de capacité,
 * de volume, de modalité d'exercice ni de coordonnées de recrutement inventés. La phrase
 * finale sur les secteurs en recrutement est ajoutée dynamiquement par chapeauEtablissement(),
 * pour qu'elle suive data.json si les besoins 2027 changent.
 */
const DESCRIPTIONS_ETABLISSEMENTS = {
  // ── RLS Pierre-Boucher ─────────────────────────────────────────────────────
  'INS-001': 'L’Hôpital Pierre-Boucher est l’hôpital du réseau local de services Pierre-Boucher, à Longueuil. Il offre des services d’urgence 24 heures sur 24 et accueille des usagers pour des séjours de courte durée en médecine, chirurgie, soins intensifs, natalité, santé mentale et gériatrie active.',
  'INS-002': 'Le Centre d’hébergement Jeanne-Crevier est un CHSLD de 93 lits situé à Boucherville, dans le RLS Pierre-Boucher. Il offre des services d’hébergement, des soins de fin de vie et des soins palliatifs, ainsi qu’un centre de jour.',
  'INS-004': 'Le CLSC de Longueuil-Ouest est une installation de première ligne du RLS Pierre-Boucher, à Longueuil. Son offre comprend notamment le soutien à domicile, les soins de fin de vie et les soins palliatifs, une clinique jeunesse, les services psychosociaux et en santé mentale, et les soins infirmiers.',
  /* Le relevé de Santé Québec nomme cette installation « CLSC des Seigneuries » à l'adresse de
     Varennes, mais santemonteregie.qc.ca n'a pas de page sous ce nom (le lien de la fiche
     pointe vers le CLSC de Verchères). Tant que l'écart n'est pas tranché avec Santé Québec, la
     description reste sur ce que le relevé affirme, sans revendiquer de page officielle. */
  'INS-005': 'Le CLSC des Seigneuries est une installation de première ligne du RLS Pierre-Boucher. Le relevé des besoins de Santé Québec Montérégie-Est le situe au 2220, boulevard René-Gaultier, à Varennes.',
  'INS-020': 'Le CLSC Simonne-Monet-Chartrand est une installation de première ligne du RLS Pierre-Boucher, à Longueuil. Son offre comprend notamment le soutien à domicile, les soins de fin de vie et les soins palliatifs, les services psychosociaux et en santé mentale, les soins infirmiers et les services intégrés de dépistage et de prévention des ITSS (SIDEP).',
  'INS-022': 'Le GMF-U des Montérégiennes est un groupe de médecine de famille universitaire situé à Boucherville, dans le RLS Pierre-Boucher, anciennement le Centre Médical Longueuil. Il a pour mission d’enseigner aux professionnels de la santé de première ligne tout en soignant des usagers et en favorisant la recherche en première ligne. Il assure la prise en charge de clientèles de tous âges, le suivi de maladies chroniques, le suivi de grossesse, des chirurgies mineures et des visites à domicile.',
  // ── RLS Pierre-De Saurel ───────────────────────────────────────────────────
  'INS-013': 'Le Centre d’hébergement Élisabeth-Lafrance est un CHSLD du RLS Pierre-De Saurel, à Sorel-Tracy. Il offre des services d’hébergement ainsi que des soins de fin de vie et des soins palliatifs.',
  'INS-014': 'Le Centre d’hébergement J.-Arsène-Parenteau est un CHSLD du RLS Pierre-De Saurel, à Sorel-Tracy. Il offre des services d’hébergement ainsi que des soins de fin de vie et des soins palliatifs.',
  'INS-015': 'Le CLSC Gaston-Bélanger offre des services à la population de Sorel-Tracy, dans le RLS Pierre-De Saurel. Son offre comprend notamment le soutien à domicile, les soins de fin de vie et les soins palliatifs, un centre de jour et un hôpital de jour, une clinique jeunesse, une clinique de santé sexuelle et les services psychosociaux et en santé mentale.',
  // ── RLS Richelieu-Yamaska ──────────────────────────────────────────────────
  'INS-006': 'L’Hôpital Honoré-Mercier est l’hôpital du réseau local de services Richelieu-Yamaska, à Saint-Hyacinthe. Il offre des services d’urgence 24 heures sur 24 et constitue un centre de niveau secondaire en traumatologie.',
  'INS-007': 'Le Centre d’hébergement de l’Hôtel-Dieu-de-Saint-Hyacinthe est un CHSLD du RLS Richelieu-Yamaska, décrit par Santé Québec Montérégie-Est comme l’un des plus importants CHSLD du Québec. Outre l’hébergement, il abrite une unité de soins palliatifs de 12 lits et l’Unité de réadaptation fonctionnelle intensive (URFI) du Verger.',
  'INS-008': 'Le Centre d’hébergement de Montarville est un CHSLD de 146 lits situé à Saint-Bruno-de-Montarville, dans le RLS Richelieu-Yamaska. Construit en 1979, il accueille une clientèle en perte d’autonomie et compte notamment une unité prothétique.',
  'INS-009': 'Le Centre d’hébergement Marguerite-Adam est un CHSLD du RLS Richelieu-Yamaska, à Beloeil. Construit en 1977 et agrandi en 2010, il offre des services d’hébergement, des soins de fin de vie et des soins palliatifs, ainsi qu’un centre de jour.',
  'INS-010': 'Le CLSC des Maskoutains est une installation de première ligne du RLS Richelieu-Yamaska, à Saint-Hyacinthe. Son offre comprend notamment le soutien à domicile, les soins de fin de vie et les soins palliatifs, une clinique jeunesse, une clinique des réfugiés et des services en diabète et en maladies respiratoires.',
  'INS-011': 'Le CLSC des Patriotes est une installation de première ligne du RLS Richelieu-Yamaska, à Beloeil. Son offre comprend notamment le soutien à domicile, les soins de fin de vie et les soins palliatifs, une clinique jeunesse, des services en diabète et les services intégrés de dépistage et de prévention des ITSS (SIDEP).',
  'INS-021': 'Le GMF-U Richelieu-Yamaska est un groupe de médecine de famille universitaire affilié à l’Université de Sherbrooke, à Saint-Hyacinthe, dans le RLS Richelieu-Yamaska. Anciennement l’Unité de médecine familiale (UMF), il assure la prise en charge de clientèles de tous âges, les suivis de grossesse et les accouchements, le suivi pédiatrique, le suivi de maladies chroniques, des chirurgies mineures et une clinique du locomoteur. Il accueille des résidents en médecine et des stagiaires des sciences de la santé.',
  // ── Missions régionales ────────────────────────────────────────────────────
  'INS-016': 'L’établissement de détention de Sorel-Tracy est un établissement de détention provincial du ministère de la Sécurité publique du Québec. Il accueille des personnes prévenues ou purgeant une peine d’emprisonnement de moins de deux ans. Les services médicaux qui y sont dispensés sont présentés ici comme une mission régionale de Santé Québec Montérégie-Est.',
  'INS-017': 'Le Centre de réadaptation en dépendance de Saint-Hyacinthe est une mission régionale. Les centres de réadaptation en dépendance offrent des services de désintoxication, de réadaptation et de réinsertion sociale aux personnes aux prises avec une dépendance à l’alcool, aux drogues et aux médicaments, aux jeux de hasard et d’argent ou à une utilisation problématique d’Internet, ainsi que des services à leur entourage.',
  'INS-019': 'Le Centre de réadaptation en dépendance de la rue Joliette, à Longueuil, est une mission régionale. Les centres de réadaptation en dépendance offrent des services de désintoxication, de réadaptation et de réinsertion sociale aux personnes aux prises avec une dépendance à l’alcool, aux drogues et aux médicaments, aux jeux de hasard et d’argent ou à une utilisation problématique d’Internet, ainsi que des services à leur entourage.'
};

/* Phrase finale commune : générée depuis data.json plutôt que recopiée dans chaque
   description, pour qu'elle reste juste si les besoins 2027 sont modifiés. */
function phraseSecteursEnRecrutement(secteurs) {
  const n = secteurs.length;
  const liste = listeSecteursHumaine(secteurs);
  if (n === 0) return '';
  if (n === 1) {
    return ` Le secteur d’activité en recrutement pour le cycle de besoins 2027 de Santé Québec Montérégie-Est : ${esc(liste)}.`;
  }
  const nombre = nombreEnLettresFr(n).replace(/^./, c => c.toUpperCase());
  return ` ${nombre} de ses secteurs d’activité sont en recrutement pour le cycle de besoins 2027 de Santé Québec Montérégie-Est : ${esc(liste)}.`;
}

function chapeauEtablissement(inst, secteurs) {
  if (inst.id === 'INS-012') {
    return 'L’Hôtel-Dieu de Sorel est l’hôpital du réseau local de services Pierre-De Saurel, à Sorel-Tracy. Cinq de ses secteurs d’activité recrutent actuellement des médecins de famille : l’urgence, l’hospitalisation, l’unité de courte durée gériatrique, l’obstétrique et les soins intensifs. Cette page présente chacun d’eux, tels que déclarés par Santé Québec Montérégie-Est pour le cycle de besoins 2027.';
  }
  if (inst.id === 'INS-003') {
    return 'Le centre d’hébergement de Contrecoeur est un CHSLD du RLS Pierre-Boucher. Son secteur de longue durée recrute actuellement des médecins de famille. Cette page présente ce secteur, tel que déclaré par Santé Québec Montérégie-Est pour le cycle de besoins 2027.';
  }
  if (DESCRIPTIONS_ETABLISSEMENTS[inst.id]) {
    return DESCRIPTIONS_ETABLISSEMENTS[inst.id] + phraseSecteursEnRecrutement(secteurs);
  }
  const n = secteurs.length;
  const liste = listeSecteursHumaine(secteurs);
  if (inst.missionRegionale && inst.id === 'INS-018') {
    return `Le centre de réadaptation en dépendance de Saint-Philippe est une mission régionale. Le site se trouve à Saint-Philippe, en Montérégie-Ouest ; il est présenté ici parce que le relevé des besoins 2027 de Santé Québec Montérégie-Est l’inclut. ${n === 1 ? 'Son secteur' : 'Ses secteurs'} d’activité en recrutement : ${esc(liste)}.`;
  }
  if (inst.missionRegionale) {
    return `${esc(inst.nom)} est une mission régionale. ${n === 1 ? 'Son secteur' : 'Ses secteurs'} en recrutement : ${esc(liste)}. Cette page reprend le relevé des besoins 2027 de Santé Québec Montérégie-Est.`;
  }
  const type = typeEnPhrase(typeEtablissementLibelle(inst.type));
  const rls = inst.territoireSource || '';
  if (n === 1) {
    return `Le ${type} ${esc(inst.nom)} se trouve à ${esc(inst.ville)}, dans le RLS ${esc(rls)}. Son secteur d’activité en recrutement est ${esc(liste)}. Cette page reprend le relevé des besoins 2027 de Santé Québec Montérégie-Est.`;
  }
  return `${esc(inst.nom)} se trouve à ${esc(inst.ville)}, dans le RLS ${esc(rls)}. ${nombreEnLettresFr(n).replace(/^./, c => c.toUpperCase())} secteurs d’activité recrutent actuellement des médecins de famille : ${esc(liste)}. Cette page reprend le relevé des besoins 2027 de Santé Québec Montérégie-Est.`;
}

function pageEtablissement(inst, secteurs, majPagesSeo, cliniqueLiee = null) {
  const u = UNIVERS_PAR_REGION.Est;
  const slug = slugEtablissement(inst);
  const url = `${SITE}${EST_PREFIXE}/etablissements/${slug}/`;
  const typeLib = typeEtablissementLibelle(inst.type);
  const n = secteurs.length;
  const liste = listeSecteursHumaine(secteurs);
  const titre = limiterTexte(inst.ville ? `${inst.nom} — ${inst.ville}` : `${inst.nom} — ${typeLib}`, 58);
  const description = limiterTexte(
    inst.id === 'INS-012'
      ? 'Hôtel-Dieu de Sorel, hôpital de Sorel-Tracy (RLS Pierre-De Saurel) : cinq secteurs en recrutement — urgence, hospitalisation, UCDG, obstétrique et soins intensifs.'
      : `${inst.nom}, ${typeEnPhrase(typeLib)} à ${inst.ville}${inst.missionRegionale ? ' (mission régionale)' : ' (RLS ' + inst.territoireSource + ')'} : ${n === 1 ? 'secteur en recrutement' : n + ' secteurs en recrutement'} — ${liste}.`,
    155
  );
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
    : '';
  const job = cliniqueLiee ? jsonLdJobPosting(cliniqueLiee, url, majPagesSeo) : null;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': url + '#webpage',
        url,
        name: titre,
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
        ...(inst.lienWeb ? { sameAs: [inst.lienWeb] } : {}),
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
      ...(job ? [job] : []),
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
  let blocHoraireEtab = '';
  let blocEquipeEtab = '';
  let lignesClinique = '';
  if (cliniqueLiee) {
    if (rempli(cliniqueLiee.dme)) {
      lignesClinique += `      <dt>Dossier médical électronique (DMÉ)</dt><dd>${esc(cliniqueLiee.dme)}</dd>\n`;
    }
    if (Array.isArray(cliniqueLiee.pratiques) && cliniqueLiee.pratiques.length) {
      lignesClinique += `      <dt>Pratiques offertes</dt><dd>${esc(cliniqueLiee.pratiques.map(p => PRATIQUES[p] || p).join(', '))}</dd>\n`;
    }
    if (rempli(cliniqueLiee.horaire)) {
      const rangs = JOURS.filter(j => rempli(cliniqueLiee.horaire[j]))
        .map(j => `        <tr><th scope="row">${j}</th><td>${esc(cliniqueLiee.horaire[j])}</td></tr>`).join('\n');
      if (rangs) {
        blocHoraireEtab = `
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
    if (rempli(cliniqueLiee.personnel)) {
      const items = Object.keys(PERSONNEL).filter(k => rempli(cliniqueLiee.personnel[k]))
        .map(k => `      <li><span class="eq-n">${esc(cliniqueLiee.personnel[k])}</span> ${esc(PERSONNEL[k])}</li>`).join('\n');
      if (items) {
        blocEquipeEtab = `
  <section id="equipe">
    <h2>Équipe sur place</h2>
    <ul class="equipe">
${items}
    </ul>
    <p class="note">Composition indiquée dans le répertoire des cliniques; à confirmer auprès du milieu.</p>
  </section>`;
      }
    }
  }
  const territoireDd = inst.missionRegionale
    ? 'Mission régionale'
    : (lienRls
      ? `<a href="${lienRls}">${esc(inst.territoireSource)}</a>`
      : esc(inst.territoireSource || ''));
  const ligneSite = siteOfficiel
    ? `      <dt>Site officiel</dt><dd>${siteOfficiel}</dd>\n`
    : '';
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
${blocHoraireEtab}${blocEquipeEtab}
  <section id="renseignements">
    <h2>Renseignements sur le lieu</h2>
    <dl class="fiche">
      <dt>Type de milieu</dt><dd>${esc(typeLib)}</dd>
      <dt>Ville</dt><dd>${esc(inst.ville || '')}</dd>
      <dt>Adresse</dt><dd>${esc(adresseCompleteEtablissement(inst))}</dd>
      <dt>Territoire</dt><dd>Montérégie-Est</dd>
      <dt>Réseau local de services (RLS)</dt><dd>${territoireDd}</dd>
      <dt>Secteurs en recrutement</dt><dd>${esc(secteurs.map(s => s.libelle).join(' · '))}</dd>
${lignesClinique}${ligneSite}    </dl>
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

function htmlExplorezSecteurs() {
  const ICON_HOSP = '<svg width="36" height="36" viewBox="0 0 56 56" fill="none"><path d="M16 46V20.5L28 12l12 8.5V46" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M24 46V34h8v12M28 24v10M23.5 29h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const ICON_COMM = '<svg width="36" height="36" viewBox="0 0 56 56" fill="none"><circle cx="21" cy="21" r="6.2" stroke="currentColor" stroke-width="1.8"/><circle cx="36.5" cy="22.5" r="5.2" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 42c1.8-7.2 6.2-10.8 10.5-10.8S29.4 34.8 31.2 42M29 42c1.3-5.4 4.5-8.8 8.8-8.8S45.4 36.8 47 42" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  return `
  <section class="es-wrap" aria-labelledby="es-titre">
    <h2 id="es-titre">Explorez par secteurs</h2>
    <p class="es-lead">Choisissez d’abord une famille de pratique, puis un secteur. Le chiffre indique le nombre de milieux en recrutement pour le cycle 2027.</p>

    <div class="es-card">
      <div class="es-chooser" id="es-chooser">
        <button type="button" class="es-fam es-fam--hosp" data-famille="hospitalier">
          <span class="es-fam-icon" aria-hidden="true">${ICON_HOSP}</span>
          <span class="es-fam-name">Hospitalier</span>
          <span class="es-fam-meta">12 secteurs · 3 hôpitaux</span>
          <span class="es-fam-cta">Voir les secteurs →</span>
        </button>
        <button type="button" class="es-fam es-fam--comm" data-famille="communautaire">
          <span class="es-fam-icon" aria-hidden="true">${ICON_COMM}</span>
          <span class="es-fam-name">Communautaire</span>
          <span class="es-fam-meta">19 secteurs · GMF-U, CHSLD, CLSC…</span>
          <span class="es-fam-cta">Voir les secteurs →</span>
        </button>
      </div>

      <div class="es-explorer" id="es-explorer" hidden>
        <div class="es-tabs">
          <div class="es-tabs-row">
            <button type="button" class="es-tab" data-famille="hospitalier" id="es-tab-hosp">Hospitalier</button>
            <button type="button" class="es-tab" data-famille="communautaire" id="es-tab-comm">Communautaire</button>
            <button type="button" class="es-back" id="es-btn-back">Retour à l’accueil</button>
          </div>
        </div>
        <div class="es-body">
          <ul class="es-list" id="es-list" role="list"></ul>
          <section class="es-panel" id="es-panel" aria-live="polite"></section>
        </div>
      </div>
    </div>
  </section>

  <style>
  .es-wrap{
    --es-bleu:#170A72;--es-menthe:#90F1E9;--es-sarcelle:#08A0A0;--es-azur:#0080D7;
    --es-ink:#27213f;--es-muted:#625d75;--es-line:#d8e3ea;
    margin:2.3rem 0;
    font-family:"Segoe UI",SegoeUI,Arial,sans-serif;
  }
  .es-wrap h2{color:var(--es-bleu);margin:0 0 .5rem}
  .es-lead{color:var(--es-muted);max-width:46rem;margin:0 0 1.3rem;font-size:1rem;line-height:1.6}
  .es-card{border:1px solid var(--es-line);border-radius:14px;background:#fff;overflow:hidden;box-shadow:0 8px 28px rgba(23,10,114,.06)}

  .es-chooser{display:grid;grid-template-columns:1fr 1fr}
  .es-chooser[hidden]{display:none!important}
  .es-fam{appearance:none;border:none;background:#fff;cursor:pointer;text-align:left;padding:2rem 1.8rem;display:flex;flex-direction:column;gap:.5rem;font-family:inherit;color:var(--es-ink);border-left:4px solid transparent;transition:background .2s;position:relative}
  .es-fam:first-child{border-right:1px solid var(--es-line)}
  .es-fam:hover{background:color-mix(in srgb, var(--es-line) 18%, #fff)}
  .es-fam:focus-visible{outline:2px solid var(--es-sarcelle);outline-offset:-2px}
  .es-fam--hosp{border-left-color:var(--es-azur)}
  .es-fam--comm{border-left-color:var(--es-sarcelle)}
  .es-fam-icon{width:36px;height:36px;display:grid;place-items:center;margin-bottom:.4rem}
  .es-fam--hosp .es-fam-icon{color:var(--es-azur)}
  .es-fam--comm .es-fam-icon{color:var(--es-sarcelle)}
  .es-fam-name{font-size:1.22rem;font-weight:700;letter-spacing:-.015em;color:var(--es-bleu)}
  .es-fam-meta{font-size:.88rem;color:var(--es-muted)}
  .es-fam-cta{margin-top:.5rem;font-size:.82rem;font-weight:650;color:var(--es-sarcelle)}

  .es-explorer[hidden]{display:none!important}
  .es-tabs{display:flex;border-bottom:1px solid var(--es-line);padding:0 1.4rem}
  .es-tabs-row{display:flex;align-items:center;width:100%}
  .es-tab{appearance:none;border:none;background:none;cursor:pointer;font-family:inherit;font-size:.9rem;font-weight:650;color:var(--es-muted);padding:1.05rem 1.05rem .95rem;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .18s,border-color .18s}
  .es-tab:hover{color:var(--es-bleu)}
  .es-tab:focus-visible{outline:2px solid var(--es-sarcelle);outline-offset:2px}
  .es-tab.on{color:var(--es-bleu);border-bottom-color:var(--es-bleu)}
  .es-back{appearance:none;border:none;background:none;cursor:pointer;margin-left:auto;font-family:inherit;font-size:.8rem;font-weight:600;color:var(--es-muted);padding:.5rem .25rem}
  .es-back:hover{color:var(--es-sarcelle)}
  .es-back:focus-visible{outline:2px solid var(--es-sarcelle);outline-offset:2px}

  .es-body{display:grid;grid-template-columns:280px minmax(0,1fr)}
  .es-list{list-style:none;margin:0;padding:.7rem;border-right:1px solid var(--es-line);display:flex;flex-direction:column;gap:2px}
  .es-row{appearance:none;border:none;background:none;cursor:pointer;width:100%;display:flex;align-items:center;gap:.7rem;padding:.7rem .7rem;border-radius:8px;text-align:left;font-family:inherit;color:var(--es-ink);transition:background .16s}
  .es-row:hover{background:color-mix(in srgb, var(--es-line) 22%, #fff)}
  .es-row:focus-visible{outline:2px solid var(--es-sarcelle);outline-offset:-2px}
  .es-row[aria-pressed="true"]{background:color-mix(in srgb, var(--dot) 9%, #fff)}
  .es-row .es-chip{width:8px;height:8px;border-radius:50%;background:var(--dot);flex-shrink:0}
  .es-row .es-txt{flex:1;min-width:0}
  .es-row .es-nom{display:block;font-size:.9rem;font-weight:650;color:var(--es-bleu)}
  .es-row .es-sous{display:block;font-size:.76rem;color:var(--es-muted);margin-top:1px}
  .es-row .es-count{flex-shrink:0;font-size:.8rem;font-weight:700;font-variant-numeric:tabular-nums;color:var(--es-muted);background:color-mix(in srgb, var(--es-line) 30%, #fff);border-radius:999px;padding:2px 9px}
  .es-row[aria-pressed="true"] .es-count{color:#fff;background:var(--dot)}

  .es-panel{padding:1.7rem 1.9rem;display:flex;flex-direction:column;gap:1rem;min-width:0}
  .es-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem}
  .es-panel-head h3{margin:0;font-size:1.2rem;font-weight:700;letter-spacing:-.01em;color:var(--es-bleu);line-height:1.3}
  .es-panel-head .es-sous{margin:.25rem 0 0;font-size:.88rem;color:var(--es-muted)}
  .es-seg{display:flex;gap:6px;align-self:flex-start;flex-shrink:0}
  .es-seg button{appearance:none;border:1px solid var(--es-line);background:#fff;border-radius:6px;padding:.4rem .7rem;cursor:pointer;font-family:inherit;font-size:.8rem;font-weight:650;color:var(--es-muted);transition:all .18s}
  .es-seg button:hover{border-color:var(--es-sarcelle);color:var(--es-sarcelle)}
  .es-seg button.on{background:var(--es-bleu);border-color:var(--es-bleu);color:#fff}
  .es-seg button:focus-visible{outline:2px solid var(--es-sarcelle);outline-offset:2px}

  .es-cards{display:flex;flex-direction:column;gap:8px}
  .es-mcard{display:block;padding:.7rem .85rem;border-radius:8px;border:1px solid var(--es-line);border-left:3px solid var(--es-line);background:#fff;font-size:.9rem;line-height:1.5;text-decoration:none;color:inherit;transition:border-color .16s,background .16s}
  .es-mcard:hover{background:color-mix(in srgb, var(--es-line) 16%, #fff)}
  .es-mcard:focus-visible{outline:2px solid var(--es-sarcelle);outline-offset:1px}
  .es-mcard .es-type{display:block;font-size:.72rem;font-weight:650;letter-spacing:.05em;text-transform:uppercase;color:var(--es-muted);margin-bottom:2px}
  .es-mcard strong{display:block;color:var(--es-bleu);font-weight:650}
  .es-mcard .es-meta{display:block;font-size:.8rem;color:var(--es-muted);margin-top:2px}
  .es-mcard.es-accent-bleu{border-left-color:var(--es-bleu)}
  .es-mcard.es-accent-azur{border-left-color:var(--es-azur)}
  .es-mcard.es-accent-sarcelle{border-left-color:var(--es-sarcelle)}

  .es-rls-label{display:block;font-size:.8rem;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--es-sarcelle);margin:.6rem 0 .4rem}
  .es-rls-label:first-child{margin-top:0}

  @media(max-width:820px){
    .es-chooser{grid-template-columns:1fr}
    .es-fam:first-child{border-right:none;border-bottom:1px solid var(--es-line)}
    .es-body{grid-template-columns:1fr}
    .es-list{border-right:none;border-bottom:1px solid var(--es-line);flex-direction:row;overflow-x:auto;padding:.6rem}
    .es-row{flex:0 0 auto;min-width:170px}
    .es-panel{padding:1.3rem 1.1rem}
    .es-panel-head{flex-direction:column;align-items:stretch}
    .es-seg{align-self:auto}
  }
  @media(max-width:520px){
    .es-fam{padding:1.5rem 1.2rem}
    .es-tabs{padding:0 .7rem}
  }
  @media(prefers-reduced-motion:reduce){
    .es-wrap *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
  }
  </style>

  <script>
  (function () {
    var ES_MILIEUX = {
      urgence: [
        { nom: "Hôpital Pierre-Boucher", ville: "Longueuil", rls: "Pierre-Boucher", type: "Hôpital", href: "${EST_PREFIXE}/etablissements/hopital-pierre-boucher/" },
        { nom: "Hôtel-Dieu de Sorel", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "Hôpital", href: "${EST_PREFIXE}/etablissements/hotel-dieu-de-sorel/" },
        { nom: "Hôpital Honoré-Mercier", ville: "Saint-Hyacinthe", rls: "Richelieu-Yamaska", type: "Hôpital", href: "${EST_PREFIXE}/etablissements/hopital-honore-mercier/" }
      ],
      hospitalisation: [
        { nom: "Hôpital Pierre-Boucher", ville: "Longueuil", rls: "Pierre-Boucher", type: "Hôpital", href: "${EST_PREFIXE}/etablissements/hopital-pierre-boucher/" },
        { nom: "Hôtel-Dieu de Sorel", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "Hôpital", href: "${EST_PREFIXE}/etablissements/hotel-dieu-de-sorel/" },
        { nom: "Hôpital Honoré-Mercier", ville: "Saint-Hyacinthe", rls: "Richelieu-Yamaska", type: "Hôpital", href: "${EST_PREFIXE}/etablissements/hopital-honore-mercier/" }
      ],
      ucdg: [
        { nom: "Hôpital Pierre-Boucher", ville: "Longueuil", rls: "Pierre-Boucher", type: "Hôpital", href: "${EST_PREFIXE}/etablissements/hopital-pierre-boucher/" },
        { nom: "Hôtel-Dieu de Sorel", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "Hôpital", href: "${EST_PREFIXE}/etablissements/hotel-dieu-de-sorel/" },
        { nom: "Hôpital Honoré-Mercier", ville: "Saint-Hyacinthe", rls: "Richelieu-Yamaska", type: "Hôpital", href: "${EST_PREFIXE}/etablissements/hopital-honore-mercier/" }
      ],
      "soins-intensifs": [
        { nom: "Hôpital Pierre-Boucher", ville: "Longueuil", rls: "Pierre-Boucher", type: "Hôpital", href: "${EST_PREFIXE}/etablissements/hopital-pierre-boucher/" },
        { nom: "Hôtel-Dieu de Sorel", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "Hôpital", href: "${EST_PREFIXE}/etablissements/hotel-dieu-de-sorel/" }
      ],
      obstetrique: [
        { nom: "Hôtel-Dieu de Sorel", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "Hôpital", href: "${EST_PREFIXE}/etablissements/hotel-dieu-de-sorel/" }
      ],
      "gmf-u": [
        { nom: "GMF-U des Montérégiennes", ville: "Boucherville", rls: "Pierre-Boucher", type: "GMF-U", href: "${EST_PREFIXE}/etablissements/gmf-u-des-monteregiennes/" },
        { nom: "GMF-U Richelieu-Yamaska", ville: "Saint-Hyacinthe", rls: "Richelieu-Yamaska", type: "GMF-U", href: "${EST_PREFIXE}/etablissements/gmf-u-richelieu-yamaska/" }
      ],
      chsld: [
        { nom: "Centre d'hébergement de Contrecoeur", ville: "Contrecoeur", rls: "Pierre-Boucher", type: "CHSLD", href: "${EST_PREFIXE}/etablissements/centre-d-hebergement-de-contrecoeur/" },
        { nom: "Centre d'hébergement Jeanne-Crevier", ville: "Boucherville", rls: "Pierre-Boucher", type: "CHSLD", href: "${EST_PREFIXE}/etablissements/centre-d-hebergement-jeanne-crevier/" },
        { nom: "Centre d'hébergement J.-Arsène-Parenteau", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "CHSLD", href: "${EST_PREFIXE}/etablissements/centre-d-hebergement-j-arsene-parenteau/" },
        { nom: "Centre d'hébergement Élisabeth-Lafrance", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "CHSLD", href: "${EST_PREFIXE}/etablissements/centre-d-hebergement-elisabeth-lafrance/" },
        { nom: "Centre d'hébergement de l'Hôtel-Dieu-de-Saint-Hyacinthe", ville: "Saint-Hyacinthe", rls: "Richelieu-Yamaska", type: "CHSLD", href: "${EST_PREFIXE}/etablissements/centre-d-hebergement-de-l-hotel-dieu-de-saint-hyacinthe/" },
        { nom: "Centre d'hébergement de Montarville", ville: "Saint-Bruno-de-Montarville", rls: "Richelieu-Yamaska", type: "CHSLD", href: "${EST_PREFIXE}/etablissements/centre-d-hebergement-de-montarville/" },
        { nom: "Centre d'hébergement Marguerite-Adam", ville: "Beloeil", rls: "Richelieu-Yamaska", type: "CHSLD", href: "${EST_PREFIXE}/etablissements/centre-d-hebergement-marguerite-adam/" }
      ],
      sad: [
        { nom: "CLSC de Longueuil-Ouest", ville: "Longueuil", rls: "Pierre-Boucher", type: "CLSC", href: "${EST_PREFIXE}/etablissements/clsc-de-longueuil-ouest/" },
        { nom: "CLSC des Seigneuries", ville: "Varennes", rls: "Pierre-Boucher", type: "CLSC", href: "${EST_PREFIXE}/etablissements/clsc-des-seigneuries/" },
        { nom: "CLSC Simonne-Monet-Chartrand", ville: "Longueuil", rls: "Pierre-Boucher", type: "CLSC", href: "${EST_PREFIXE}/etablissements/clsc-simonne-monet-chartrand/" },
        { nom: "CLSC Gaston-Bélanger", ville: "Sorel-Tracy", rls: "Pierre-De Saurel", type: "CLSC", href: "${EST_PREFIXE}/etablissements/clsc-gaston-belanger/" },
        { nom: "CLSC des Maskoutains", ville: "Saint-Hyacinthe", rls: "Richelieu-Yamaska", type: "CLSC", href: "${EST_PREFIXE}/etablissements/clsc-des-maskoutains/" },
        { nom: "CLSC des Patriotes", ville: "Beloeil", rls: "Richelieu-Yamaska", type: "CLSC", href: "${EST_PREFIXE}/etablissements/clsc-des-patriotes/" }
      ],
      autres: [
        { nom: "Centre de réadaptation en dépendance Longueuil", ville: "Longueuil", rls: "Mission régionale", type: "CRD", href: "${EST_PREFIXE}/etablissements/centre-de-readaptation-en-dependance-longueuil/" },
        { nom: "Centre de réadaptation en dépendance Saint-Hyacinthe", ville: "Saint-Hyacinthe", rls: "Mission régionale", type: "CRD", href: "${EST_PREFIXE}/etablissements/centre-de-readaptation-en-dependance-saint-hyacinthe/" },
        { nom: "Centre de réadaptation en dépendance Saint-Philippe", ville: "Saint-Philippe", rls: "Mission régionale", type: "CRD", href: "${EST_PREFIXE}/etablissements/centre-de-readaptation-en-dependance-saint-philippe/" },
        { nom: "Centre de détention", ville: "Sorel-Tracy", rls: "Mission régionale", type: "Détention", href: "${EST_PREFIXE}/etablissements/centre-de-detention/" }
      ]
    };

    var ES_HOSPITALIER = [
      { id: "urgence", nom: "Urgence", sous: "Accueil 24 h", dot: "var(--es-azur)" },
      { id: "hospitalisation", nom: "Hospitalisation", sous: "Courte durée", dot: "var(--es-bleu)" },
      { id: "obstetrique", nom: "Obstétrique", sous: "Sorel seulement", dot: "var(--es-sarcelle)" },
      { id: "ucdg", nom: "UCDG", sous: "Gériatrie courte durée", dot: "var(--es-sarcelle)" },
      { id: "soins-intensifs", nom: "Soins intensifs", sous: "Unités ≤ 6 lits", dot: "var(--es-bleu)" }
    ];

    var ES_COMMUNAUTAIRE = [
      { id: "gmf-u", nom: "GMF-U", sous: "Première ligne universitaire", dot: "var(--es-azur)" },
      { id: "chsld", nom: "CHSLD", sous: "Longue durée", dot: "var(--es-sarcelle)" },
      { id: "sad", nom: "Soins à domicile", sous: "SAD, SIAD et palliatifs", dot: "var(--es-azur)" },
      { id: "autres", nom: "Autres", sous: "Réadaptation et détention", dot: "var(--es-bleu)" }
    ];

    var esState = { famille: null, secteur: "", parRls: false };
    var esChooser = document.getElementById("es-chooser");
    var esExplorer = document.getElementById("es-explorer");
    var esList = document.getElementById("es-list");
    var esPanel = document.getElementById("es-panel");
    var esTabHosp = document.getElementById("es-tab-hosp");
    var esTabComm = document.getElementById("es-tab-comm");
    if (!esChooser || !esExplorer || !esList || !esPanel || !esTabHosp || !esTabComm) return;

    function esItems() {
      return esState.famille === "hospitalier" ? ES_HOSPITALIER : ES_COMMUNAUTAIRE;
    }

    function esListe() {
      if (esState.secteur && ES_MILIEUX[esState.secteur]) return ES_MILIEUX[esState.secteur];
      var ids = esItems().map(function (s) { return s.id; });
      var vus = {};
      var out = [];
      ids.forEach(function (id) {
        ES_MILIEUX[id].forEach(function (m) {
          var cle = m.nom + m.rls;
          if (vus[cle]) return;
          vus[cle] = true;
          out.push(m);
        });
      });
      return out;
    }

    function esFamilleNom() {
      return esState.famille === "hospitalier" ? "Hospitalier" : "Communautaire";
    }

    function esSyncTabs() {
      esTabHosp.classList.toggle("on", esState.famille === "hospitalier");
      esTabComm.classList.toggle("on", esState.famille === "communautaire");
    }

    function esOpenFamille(famille) {
      esState.famille = famille;
      esState.secteur = "";
      esState.parRls = false;
      esChooser.hidden = true;
      esExplorer.hidden = false;
      esSyncTabs();
      esDrawList();
      esDrawPanel();
      esExplorer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function esBack() {
      esState.famille = null;
      esState.secteur = "";
      esState.parRls = false;
      esChooser.hidden = false;
      esExplorer.hidden = true;
      esList.innerHTML = "";
      esPanel.innerHTML = "";
    }

    function esMilieuxLabel(n) {
      return n + (n > 1 ? " milieux" : " milieu");
    }

    function esDrawList() {
      var list = esItems();
      esList.innerHTML = list.map(function (item) {
        var n = ES_MILIEUX[item.id].length;
        var pressed = esState.secteur === item.id;
        return '<li><button type="button" class="es-row" data-id="' + item.id +
          '" aria-pressed="' + pressed + '" style="--dot:' + item.dot + '">' +
          '<span class="es-chip" aria-hidden="true"></span>' +
          '<span class="es-txt"><span class="es-nom">' + item.nom + '</span>' +
          '<span class="es-sous">' + item.sous + '</span></span>' +
          '<span class="es-count">' + n + '</span></button></li>';
      }).join("");
      esList.querySelectorAll(".es-row").forEach(function (btn) {
        btn.onclick = function () { esSelectSecteur(btn.getAttribute("data-id")); };
      });
    }

    function esSelectSecteur(id) {
      esState.secteur = esState.secteur === id ? "" : id;
      esState.parRls = false;
      esList.querySelectorAll(".es-row").forEach(function (b) {
        var on = b.getAttribute("data-id") === esState.secteur;
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      esDrawPanel();
    }

    function esAccent(type) {
      if (type === "Hôpital") return " es-accent-bleu";
      if (type === "CLSC" || type === "GMF-U") return " es-accent-azur";
      if (type === "CHSLD") return " es-accent-sarcelle";
      return "";
    }

    function esCard(m) {
      return '<a class="es-mcard' + esAccent(m.type) + '" href="' + m.href + '"><span class="es-type">' + m.type +
        "</span><strong>" + m.nom + '</strong><span class="es-meta">' + m.ville + " · " + m.rls + "</span></a>";
    }

    function esDrawPanel() {
      var meta = esItems().filter(function (s) { return s.id === esState.secteur; })[0];
      var milieux = esListe();
      var titre = meta ? meta.nom : "Tous les milieux";
      var sous = meta
        ? meta.sous + " · " + esMilieuxLabel(milieux.length)
        : (esState.famille === "hospitalier"
          ? milieux.length + " établissements · tous les secteurs de cette famille"
          : esMilieuxLabel(milieux.length) + " · tous les secteurs de cette famille");
      var body = "";
      if (esState.parRls) {
        var groupes = [];
        var index = {};
        milieux.forEach(function (m) {
          if (!index[m.rls]) { index[m.rls] = []; groupes.push({ rls: m.rls, arr: index[m.rls] }); }
          index[m.rls].push(m);
        });
        groupes.forEach(function (g) {
          body += '<div class="es-rls-label">' + g.rls + " · " + g.arr.length + '</div><div class="es-cards">' + g.arr.map(esCard).join("") + "</div>";
        });
      } else {
        body = '<div class="es-cards">' + milieux.map(esCard).join("") + "</div>";
      }
      esPanel.innerHTML =
        '<div class="es-panel-head"><div><h3>' + titre + '</h3><p class="es-sous">' + sous + "</p></div>" +
        '<div class="es-seg" role="group" aria-label="Classement">' +
        '<button type="button" id="es-btn-list" aria-pressed="' + (esState.parRls ? "false" : "true") + '"' + (esState.parRls ? "" : ' class="on"') + ">Liste</button>" +
        '<button type="button" id="es-btn-rls" aria-pressed="' + (esState.parRls ? "true" : "false") + '"' + (esState.parRls ? ' class="on"' : "") + ">Par RLS</button></div></div>" +
        '<div class="es-panel-body">' + body + "</div>";
      document.getElementById("es-btn-list").onclick = function () { esState.parRls = false; esDrawPanel(); };
      document.getElementById("es-btn-rls").onclick = function () { esState.parRls = true; esDrawPanel(); };
    }

    document.querySelectorAll(".es-fam").forEach(function (btn) {
      btn.onclick = function () { esOpenFamille(btn.getAttribute("data-famille")); };
    });
    esTabHosp.onclick = function () { esOpenFamille("hospitalier"); };
    esTabComm.onclick = function () { esOpenFamille("communautaire"); };
    document.getElementById("es-btn-back").onclick = esBack;

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (esState.secteur) { esSelectSecteur(esState.secteur); return; }
      if (esState.famille) esBack();
    });
  })();
  </script>`;
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
      const note = viaCarte
        ? (inst.type === 'gmf-u' ? 'Page de la clinique GMF-U' : 'Fiche sur la carte')
        : `${secteurs.length} secteur${secteurs.length > 1 ? 's' : ''}`;
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
        name: 'Secteurs en établissement en Montérégie-Est',
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
    <p class="lead">Les secteurs d’activité en établissement se distinguent de la pratique en clinique : urgence, hospitalisation, unité de courte durée gériatrique (UCDG), longue durée (CHSLD), soins à domicile, réadaptation, détention, etc. Les installations ci-dessous proviennent du relevé des besoins en effectifs médicaux 2027 de Santé Québec Montérégie-Est.</p>
    <p class="updated"><strong>Données déclarées par le milieu le :</strong> ${DATE_SOURCE_ETABLISSEMENTS}.</p>
    <div class="cta-row">
      <a class="button primary" href="${EST_PREFIXE}/?mode=etablissements">Explorer sur la carte interactive</a>
      <a class="button secondary" href="${EST_PREFIXE}/cliniques/">Cliniques de la Montérégie-Est</a>
    </div>
  </section>

  ${htmlBanniereSqb('../../assets', { estActif: true })}

  ${htmlExplorezSecteurs()}

${sections}`;

  // Les 22 fiches sont publiées. Les coordonnées nominatives d’établissement ne sont
  // pas affichées (pas de ligne « À venir »).
  const indexable = true;
  return {
    html: page({
      titre: limiterTexte('Secteurs en établissement en Montérégie-Est', 58),
      description: limiterTexte('Installations de la Montérégie-Est dont un ou plusieurs secteurs recrutent des médecins de famille : hôpitaux, CHSLD, CLSC, GMF-U et missions régionales.', 155),
      url, profondeur: 2, indexable, jsonLd, actif: 'etablissements', univers: u,
      filDAriane: `<a href="${EST_ACCUEIL}">Montérégie-Est</a> › Secteurs en établissement`,
      corps
    }),
    indexable
  };
}

/* Ancien slug INS-018 : « Ste-Philippe » dans le nom produisait …/ste-philippe/. */
const REDIRECTIONS_ETABLISSEMENTS = [
  {
    ancien: 'centre-de-readaptation-en-dependance-ste-philippe',
    nouveau: 'centre-de-readaptation-en-dependance-saint-philippe',
    libelle: 'La fiche du Centre de réadaptation en dépendance Saint-Philippe'
  }
];

function publierPagesEtablissements(slugsCliniques, entrees, majPagesSeo, cliniquesById) {
  const donnees = chargerDonneesEtablissements();
  const repertoire = pageRepertoireEtablissements(donnees, slugsCliniques, majPagesSeo);
  ecrire(path.join('monteregie-est', 'etablissements', 'index.html'), repertoire.html);
  if (repertoire.indexable) {
    entrees.push({ loc: '/monteregie-est/etablissements/', lastmod: majPagesSeo, changefreq: 'weekly', priority: '0.8' });
  }
  const conserves = new Set();
  let n = 0;
  for (const id of PREMIER_LOT_ETABLISSEMENTS) {
    const inst = (donnees.installations || []).find(i => i.id === id);
    if (!inst) throw new Error('Installation du premier lot introuvable : ' + id);
    const secteurs = secteursDe(donnees, id);
    const cliniqueLiee = (inst.referenceExistante && inst.referenceExistante.collection === 'cliniques'
      && cliniquesById)
      ? cliniquesById.get(String(inst.referenceExistante.id))
      : null;
    const p = pageEtablissement(inst, secteurs, majPagesSeo, cliniqueLiee);
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
  { loc: '/monteregie-est/ptem/', lastmod: null, changefreq: 'weekly', priority: '0.9' },
  { loc: '/monteregie-est/amp/', lastmod: null, changefreq: 'monthly', priority: '0.9' },
  /* /monteregie/ (carte des 3 territoires) reste en ligne pour les humains mais n’est plus
     dans le sitemap : elle concurrence l’accueil et /monteregie-est/. */
  { loc: '/monteregie-centre/', lastmod: null, changefreq: 'monthly', priority: '0.6' },
  { loc: '/monteregie-ouest/', lastmod: null, changefreq: 'monthly', priority: '0.6' }
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
  /* Canonical en URL de production (Google). Refresh et location.replace en chemin relatif
     pour rester sur le même hôte (aperçu, localhost) au lieu de forcer trouvetaclinique.ca. */
  const dest = String(destination);
  const chemin = dest.startsWith('http')
    ? (dest.replace(/^https?:\/\/[^/]+/, '') || '/')
    : (dest.startsWith('/') ? dest : '/' + dest);
  const canon = SITE + chemin;
  const urlHtml = esc(chemin);
  const canonHtml = esc(canon);
  const libelleHtml = esc(libelle);
  const destJs = JSON.stringify(chemin);
  return `<!doctype html>
<html lang="fr-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Page déplacée | Trouve ta clinique</title>
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${canonHtml}">
<meta http-equiv="refresh" content="0; url=${urlHtml}">
<script>(function(){var b=${destJs};var d=b;if(location.search)d+= (d.indexOf("?")>=0?"&":"?")+location.search.slice(1);if(location.hash)d+=location.hash;location.replace(d);})();</script>
</head>
<body>
<p>${libelleHtml} a été déplacée. <a href="${urlHtml}">Continuer vers la nouvelle adresse</a>.</p>
</body>
</html>
`;
}

const FAQ_PTEM = {
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Qu’est-ce que le PTEM?',
      acceptedAnswer: { '@type': 'Answer', text: 'Les plans territoriaux des effectifs médicaux (PTEM) répartissent géographiquement les effectifs en médecine de famille. Une cible annuelle de recrutement est autorisée pour chaque région.' }
    },
    {
      '@type': 'Question',
      name: 'PTEM ou PREM : quelle différence?',
      acceptedAnswer: { '@type': 'Answer', text: 'PTEM est l’appellation actuelle de ce qui était auparavant appelé PREM en médecine de famille. Les deux termes désignent la même réalité administrative.' }
    },
    {
      '@type': 'Question',
      name: 'Qu’est-ce que la règle du 55 %?',
      acceptedAnswer: { '@type': 'Answer', text: 'L’avis de conformité PTEM précise la région ou le sous-territoire où le médecin doit réaliser au moins 55 % de ses jours de facturation.' }
    },
    {
      '@type': 'Question',
      name: 'Quand déposer une demande PTEM 2027?',
      acceptedAnswer: { '@type': 'Answer', text: 'L’Accord no 820 fixe la période initiale de dépôt du 1er au 15 décembre 2026. Une demande ne peut pas être soumise avant le 1er décembre 2026.' }
    }
  ]
};

const FAQ_AMP = {
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Qu’est-ce qu’une AMP?',
      acceptedAnswer: { '@type': 'Answer', text: 'Une activité médicale particulière (AMP) est une activité reconnue dans l’Entente particulière AMP, utilisée par les DTMF pour orienter une partie de l’activité des médecins de famille vers des besoins prioritaires.' }
    },
    {
      '@type': 'Question',
      name: 'Combien d’heures d’AMP faut-il faire?',
      acceptedAnswer: { '@type': 'Answer', text: 'Pour les 15 premières années de pratique, l’engagement est de 12 heures d’AMP par semaine ou l’équivalent, soit au moins 132 heures par trimestre selon la RAMQ.' }
    },
    {
      '@type': 'Question',
      name: 'Que se passe-t-il après 15 ans de pratique?',
      acceptedAnswer: { '@type': 'Answer', text: 'L’adhésion à l’Entente AMP reste obligatoire. Sauf circonstances particulières, les activités usuelles sont alors reconnues à titre d’AMP par le DTMF.' }
    },
    {
      '@type': 'Question',
      name: 'Qui doit adhérer aux AMP?',
      acceptedAnswer: { '@type': 'Answer', text: 'Tous les médecins de famille qui exercent dans le régime public sont visés par l’engagement AMP.' }
    }
  ]
};

/*
 * Les pages PTEM et AMP sont publiées depuis un instantané figé (scripts/sources/*.html)
 * pris avant le passage de la navigation mobile au menu hamburger : leur header n'a donc
 * ni bouton, ni id="site-nav", ni le script d'ouverture, et le menu disparaissait sous
 * 680 px. Plutôt que de refiger les instantanés à chaque évolution du header, on les
 * normalise à la publication. La fonction est idempotente : si l'instantané est un jour
 * régénéré avec le bouton, rien n'est ajouté deux fois.
 */
function normaliserPageGuide(html, nom) {
  let sortie = html;

  /* L'instantané embarque aussi l'ancien ménage de service worker (désinscription seule,
     sans purge ni rechargement). On le remplace par la version courante. */
  sortie = sortie.replace(
    /<script>\s*if \('serviceWorker' in navigator && navigator\.serviceWorker\.getRegistrations\)[\s\S]*?<\/script>/,
    () => SERVICE_WORKER_CLEANUP
  );

  if (!/id="site-nav"/.test(sortie)) {
    sortie = sortie.replace(
      /<nav aria-label="Navigation principale" class="nav">/,
      '<nav aria-label="Navigation principale" class="nav" id="site-nav">'
    );
  }

  if (!/class="nav-toggle"/.test(sortie)) {
    sortie = sortie.replace(
      /(<nav aria-label="Navigation principale" class="nav"[^>]*>)/,
      `${NAV_TOGGLE_BOUTON}\n$1`
    );
  }

  if (!/getElementById\('nav-toggle'\)/.test(sortie)) {
    sortie = sortie.replace('</body>', `${NAV_TOGGLE_SCRIPT}\n</body>`);
  }

  if (!sortie.includes('/etablissements/')) {
    sortie = sortie.replace(
      '<a href="/monteregie-est/cliniques/">Cliniques</a>',
      '<a href="/monteregie-est/cliniques/">Cliniques</a>\n<a href="/monteregie-est/etablissements/">Établissements</a>'
    );
  }

  sortie = sortie.replace(/https:\/\/trouvetaclinique\.ca\/assets\/banniere_monteregie-est\.jpg/g, OG_PARTAGE.url);
  sortie = sortie.replace(/property="og:image:width" content="1024"/g, `property="og:image:width" content="${OG_PARTAGE.largeur}"`);
  sortie = sortie.replace(/property="og:image:height" content="341"/g, `property="og:image:height" content="${OG_PARTAGE.hauteur}"`);
  sortie = sortie.replace(/"dateModified": "[0-9]{4}-[0-9]{2}-[0-9]{2}"/g, '"dateModified": "2026-09-04"');
  sortie = sortie.replace(/<meta name="google-site-verification"[^>]*>\s*/g, '');

  if (nom === 'amp') {
    sortie = sortie.replace(
      /<title>AMP en médecine familiale — règles et Montérégie \| Trouve ta clinique<\/title>/,
      '<title>AMP en médecine familiale — Montérégie</title>'
    );
    sortie = sortie.replace(
      /property="og:title" content="AMP en médecine familiale — règles et Montérégie \| Trouve ta clinique"/,
      'property="og:title" content="AMP en médecine familiale — Montérégie"'
    );
  }

  if (nom && !sortie.includes('"@type": "FAQPage"')) {
    const faq = nom === 'amp' ? FAQ_AMP : FAQ_PTEM;
    const bloc = `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', ...faq }, null, 2)}\n</script>\n`;
    sortie = sortie.replace('</head>', bloc + '</head>');
  }

  return sortie;
}

function publierPagesGuide() {
  for (const nom of ['ptem', 'amp']) {
    const source = path.join(RACINE, 'scripts', 'sources', nom + '.html');
    if (!fs.existsSync(source)) {
      throw new Error(`Source manquante : scripts/sources/${nom}.html — exécuter node scripts/creer-modeles-guide.js une fois.`);
    }
    const html = normaliserPageGuide(
      fs.readFileSync(source, 'utf8').replace(/\{\{ASSETS\}\}/g, '../../assets'),
      nom
    );
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

function exporterRedirectionsCloudflare() {
  /* Format Cloudflare (pas d’en-tête) :
     source,target,status,preserve_query_string,include_subdomains,subpath_matching
     include_subdomains=FALSE : ne pas attraper apercu.trouvetaclinique.ca.
     subpath_matching=FALSE : /cliniques/ ne doit pas tout envoyer vers l’Est. */
  const lignes = [];
  const vus = new Set();
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['.git', 'node_modules', 'canvases', '.github'].includes(e.name)) continue;
        walk(p);
      } else if (e.name === 'index.html') {
        const html = fs.readFileSync(p, 'utf8');
        if (!html.includes('location.replace') || !html.includes('http-equiv="refresh"')) continue;
        const canon = (html.match(/rel="canonical" href="([^"]+)/) || [])[1];
        if (!canon) continue;
        let rel = path.relative(RACINE, path.dirname(p)).replace(/\\/g, '/');
        if (rel === '.') rel = '';
        const source = SITE + '/' + (rel ? rel + '/' : '');
        if (source === canon) continue;
        const cle = source + '>' + canon;
        if (vus.has(cle)) continue;
        vus.add(cle);
        lignes.push([source, canon, '301', 'TRUE', 'FALSE', 'FALSE'].join(','));
      }
    }
  }
  walk(RACINE);
  ecrire(path.join('scripts', 'cloudflare-bulk-redirects.csv'), lignes.join('\n') + '\n');
  return lignes.length;
}

function ecrireLlmsTxt() {
  ecrire('llms.txt', `# Trouve ta clinique

Site d'information pour les médecins de famille et les résidents qui cherchent un milieu de pratique en Montérégie (Québec) : cliniques en recrutement, secteurs en établissement, PTEM et AMP.

- Public : médecins et résidents, pas les patients à la recherche d'un rendez-vous.
- Territoires : Montérégie-Est, Montérégie-Centre, Montérégie-Ouest.
- URL canonique : https://trouvetaclinique.ca/
- Carte Est : https://trouvetaclinique.ca/monteregie-est/
- PTEM : https://trouvetaclinique.ca/monteregie-est/ptem/
- AMP : https://trouvetaclinique.ca/monteregie-est/amp/

Ne pas utiliser ce site pour prendre rendez-vous comme patient : Rendez-vous santé Québec ou le 811.
`);
}

function main() {
  const donnees = JSON.parse(fs.readFileSync(path.join(RACINE, 'data.json'), 'utf8'));
  const majDonnees = donnees.miseAJour || new Date().toISOString().slice(0, 10);

  /* Date du dernier changement de gabarit (texte/CSS des pages, indépendant des données de clinique).
     Une refonte du gabarit modifie aussi le contenu HTML, même si data.json n'a pas changé — le
     sitemap doit donc en tenir compte pour son lastmod. Mettre à jour cette date à la main lors
     d'une prochaine modification des templates ci-dessous. */
  const majGabaritsSeo = '2026-09-04';
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
  indexerGmfuCanoniques();
  const cliniquesById = new Map(cliniques.map(c => [String(c.id), c]));

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
    const slugEtab = HREF_GMFU_ETABLISSEMENT[String(c.id)];
    if (slugEtab) {
      const dest = `${SITE}${EST_PREFIXE}/etablissements/${slugEtab}/`;
      const redir = pageRedirectionStatique(dest, `La fiche de ${c.nom}`);
      ecrire(path.join('cliniques', slug, 'index.html'), redir);
      const uRegion = UNIVERS_PAR_REGION[c.region];
      if (uRegion) {
        ecrire(path.join(uRegion.dossier, 'cliniques', slug, 'index.html'), redir);
        copiesRegionales++;
      }
      continue;
    }

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

  const nEtabSeo = publierPagesEtablissements(slugs, entrees, majPagesSeo, cliniquesById);

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
  ecrireLlmsTxt();
  const nRedirCf = exporterRedirectionsCloudflare();

  /* Rapport */
  console.log('=== GÉNÉRATION DES PAGES SEO ===');
  console.log(`data.json du ${majDonnees} — ${toutes.length} fiches source : ${cliniques.length} cliniques publiées (${cliniques.filter(recrute).length} en recrutement, ${cliniques.filter(c => !recrute(c)).length} hors recrutement), ${etablissements.length} établissements dans la couche cartographique${horsPublication ? `, ${horsPublication} fiche(s) hors publication` : ''}`);
  console.log(`Pages de cliniques : ${cliniques.length} générées, ${indexables} indexables, ${minces.length} en noindex (moins de ${SEUIL_INDEXATION} champs remplis)`);
  console.log(`Pages de RLS       : ${parRls.size}`);
  console.log(`Répertoire         : cliniques/index.html`);
  console.log(`Établissements     : répertoire + ${nEtabSeo} fiche(s) (premier lot)`);
  console.log(`Sitemap            : ${entrees.length} URL`);
  console.log(`Redirections CF    : ${nRedirCf} (scripts/cloudflare-bulk-redirects.csv)`);
  console.log(`GMF-U canoniques   : ${Object.keys(HREF_GMFU_ETABLISSEMENT).length} fiches cliniques redirigées vers /etablissements/`);
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
