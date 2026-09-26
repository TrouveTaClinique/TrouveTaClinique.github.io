/* La liste et les liens sont présents dans le HTML, même sans JavaScript.
   Deux pages utilisent ce script : /guides/ (guides cliniques) et
   /guides/ressources-communautaires/ (organismes) ; body[data-page] les distingue. */
(function () {
  'use strict';
  const page = document.body.dataset.page || 'guides';
  /* Anciens liens vers la section communautaire de /guides/ : elle a sa propre page. */
  const versAutrePage = () => {
    if (page !== 'guides' || location.hash !== '#sujet-ressources-communautaires' || !document.body.dataset.autrePage) return false;
    location.replace(document.body.dataset.autrePage);
    return true;
  };
  if (versAutrePage()) return;
  window.addEventListener('hashchange', versAutrePage);
  const input = document.getElementById('guide-search');
  if (!input) return;
  const MOT = document.body.dataset.mot || 'ressource';
  const pluriel = (n, mot) => n + ' ' + mot + (n > 1 ? 's' : '');
  const form = document.querySelector('.guides-search-form');
  const moteur = window.GuidesRecherche;
  const sections = Array.from(document.querySelectorAll('.guides-category'));
  const status = document.getElementById('guide-status');
  const empty = document.querySelector('.guides-empty');
  const communautaire = document.querySelector('.guides-communautaire');
  /* Filtres : chaque liste déroulante porte data-filtre, le nom de l'attribut data-* des fiches
     (category, org, rubriques, ville). La case « hors territoire » masque par défaut les
     organismes situés hors de la Montérégie-Est. */
  const filtres = Array.from(document.querySelectorAll('select[data-filtre]'));
  const caseHors = document.getElementById('guides-hors');
  const SANS_ADRESSE = '(sans adresse)';
  const effacerFiltres = document.querySelector('.guides-filtres-reset');
  const resSection = document.querySelector('.guides-resultats');
  const resList = resSection.querySelector('.guides-resource-list');
  const resources = Array.from(document.querySelectorAll('#guides-catalogue .guides-resource')).map(el => ({
    el, id: el.dataset.id, category: el.dataset.category, org: el.dataset.org, comm: el.dataset.type === 'communautaire',
    ville: el.dataset.ville || '', hors: el.dataset.hors === '1', rubriques: (el.dataset.rubriques || '').split('|')
  }));
  if (!moteur || !filtres.length) return; // la liste complète reste affichée
  /* Organismes communautaires : leur source commune (le bottin) n'est pas cherchée, leur ville
     compte comme le nom et leur rubrique comme une catégorie. Même préparation pour les fiches
     de l'autre page, lues dans guides/donnees.json. */
  const preparer = f => moteur.preparer(f.comm
    ? { titre: f.titre + ' ' + f.ville, organisme: '', categorie: 'Ressources communautaires ' + f.rubriques, motsCles: f.tags, description: f.desc }
    : { titre: f.titre, organisme: f.org, categorie: f.cat, motsCles: f.tags, description: f.desc });
  const index = resources.map(r => preparer({
    comm: r.comm, titre: r.el.dataset.title, ville: r.ville, org: r.org, cat: r.category,
    rubriques: r.el.dataset.rubriquesDetail || '', tags: r.el.dataset.tags, desc: r.el.dataset.desc
  }));
  const communautaires = resources.map(r => r.comm);
  const classer = (requete, seuil) => moteur.rechercherParType(index, communautaires, requete, { seuil });
  document.querySelector('.guides-filter-area').hidden = false;

  /* Favoris : gardés dans ce navigateur seulement (localStorage), sans compte ni
     synchronisation. La clé contient les URL des ressources, dans l'ordre d'ajout ; elle est
     commune aux deux pages, qui n'affichent chacune que leurs propres fiches. */
  const CLE_FAVORIS = 'ttc-guides-favoris';
  const favSection = document.querySelector('.guides-favoris');
  const favList = favSection.querySelector('.guides-resource-list');
  const parId = new Map(resources.map(r => [r.el.dataset.id, r]));
  let tousFavoris = [];   // y compris ceux de l'autre page, à conserver tels quels
  let favoris = [];       // ceux de cette page
  const lireFavoris = () => {
    try {
      const v = JSON.parse(localStorage.getItem(CLE_FAVORIS) || '[]');
      tousFavoris = Array.isArray(v) ? v.filter(id => typeof id === 'string') : [];
    } catch (e) { /* stockage illisible : on garde la liste en mémoire */ }
    favoris = tousFavoris.filter(id => parId.has(id));
  };
  lireFavoris();
  const enregistrer = () => { try { localStorage.setItem(CLE_FAVORIS, JSON.stringify(tousFavoris)); } catch (e) { /* stockage bloqué : favoris pour cette visite seulement */ } };
  const ETOILE = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.1l-5.7 3.2 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
  function majEtoile(bouton, id) {
    const actif = favoris.includes(id);
    const titre = parId.get(id).el.dataset.title;
    bouton.setAttribute('aria-pressed', String(actif));
    bouton.setAttribute('aria-label', (actif ? 'Retirer « ' : 'Ajouter « ') + titre + (actif ? ' » des favoris' : ' » aux favoris'));
    bouton.title = actif ? 'Retirer des favoris' : 'Ajouter aux favoris';
  }
  function ajouterEtoile(li) {
    const id = li.dataset.id;
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'guides-fav';
    bouton.innerHTML = ETOILE;
    majEtoile(bouton, id);
    bouton.addEventListener('click', () => basculer(id));
    li.appendChild(bouton);
  }
  function basculer(id) {
    tousFavoris = tousFavoris.includes(id) ? tousFavoris.filter(f => f !== id) : [id, ...tousFavoris];
    favoris = tousFavoris.filter(f => parId.has(f));
    enregistrer();
    construireFavoris();
    render();
  }
  function cloner(id) {
    const clone = parId.get(id).el.cloneNode(true);
    clone.hidden = false;
    clone.querySelector('.guides-fav').remove();
    ajouterEtoile(clone);
    return clone;
  }
  function construireFavoris() {
    favList.replaceChildren(...favoris.map(cloner));
    document.querySelectorAll('.guides-fav').forEach(b => majEtoile(b, b.parentElement.dataset.id));
  }
  resources.forEach(r => ajouterEtoile(r.el));
  construireFavoris();
  window.addEventListener('storage', event => {
    if (event.key !== CLE_FAVORIS) return;
    lireFavoris(); construireFavoris(); render();
  });

  /* Sans recherche ni filtre, les sujets sont fermés : leur titre est un bouton qui ouvre la
     liste. Une recherche ou un filtre les ouvre tous. Sans JavaScript, tout reste affiché. */
  const titreCatalogue = document.querySelector('.guides-catalogue-titre');
  const recents = document.querySelector('.guides-recents');
  const ouverts = new Set();   // sujets ouverts à la main (catalogue complet)
  const fermes = new Set();    // sujets refermés à la main (recherche ou filtre en cours)
  let replier = true;
  sections.forEach((section, n) => {
    const liste = section.querySelector('.guides-resource-list');
    liste.id = liste.id || 'guides-liste-' + n;
    const h2 = section.querySelector('.guides-category-heading h2');
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'guides-toggle';
    bouton.setAttribute('aria-controls', liste.id);
    const chevron = document.createElement('span');
    chevron.className = 'guides-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    bouton.append(...h2.childNodes, ' ', section.querySelector('.guides-category-heading .compte'), chevron);
    h2.replaceChildren(bouton);
    bouton.addEventListener('click', () => {
      const ensemble = replier ? ouverts : fermes;
      if (ensemble.has(section)) ensemble.delete(section); else ensemble.add(section);
      render();
    });
  });
  function ouvrirDepuisAncre() {
    const cible = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!cible || !sections.includes(cible)) return;
    ouverts.add(cible); fermes.delete(cible); render();
    cible.scrollIntoView();
  }
  window.addEventListener('hashchange', ouvrirDepuisAncre);

  const badge = (el, n, mot) => { el.textContent = n; el.setAttribute('aria-label', pluriel(n, mot)); };

  const correspond = (r, cle, valeur) => {
    if (!valeur) return true;
    if (cle === 'rubriques') return r.rubriques.includes(valeur);
    if (cle === 'ville') return valeur === SANS_ADRESSE ? !r.ville : r.ville === valeur;
    return r.el.dataset[cle] === valeur;
  };
  const selVille = filtres.find(s => s.dataset.filtre === 'ville');
  /* Hors territoire : visible si la case est cochée ou si sa ville est choisie dans le filtre. */
  const horsVisible = r => !r.hors || (caseHors && caseHors.checked) || (selVille && selVille.value === r.ville);

  function render() {
    const requete = input.value.trim();
    const actifs = filtres.filter(s => s.value);
    const retenus = new Map(); // id -> score
    let horsMasques = 0;
    classer(requete, 0.25).forEach(({ i, score }) => {
      const r = resources[i];
      if (!filtres.every(s => correspond(r, s.dataset.filtre, s.value))) return;
      if (!horsVisible(r)) { horsMasques++; return; }
      retenus.set(r.id, score);
    });
    const count = retenus.size;
    resources.forEach(r => { r.el.hidden = !retenus.has(r.id); });

    /* Favoris : mêmes critères que le catalogue. */
    let favVisibles = 0;
    favList.querySelectorAll('.guides-resource').forEach(li => { li.hidden = !retenus.has(li.dataset.id); if (!li.hidden) favVisibles++; });
    favSection.hidden = favVisibles === 0;
    badge(favSection.querySelector('.compte'), favVisibles, 'favori');

    /* Avec une recherche : une seule liste classée par pertinence. Sans recherche : les catégories. */
    const enRecherche = requete !== '' && count > 0;
    resSection.hidden = !enRecherche;
    if (enRecherche) {
      resList.replaceChildren(...[...retenus.keys()].map(cloner));
      badge(resSection.querySelector('.compte'), count, 'ressource');
    } else {
      resList.replaceChildren();
    }
    replier = !requete && !actifs.length;
    titreCatalogue.hidden = enRecherche;
    let visible = favVisibles ? 1 : 0;
    if (enRecherche) visible++;
    sections.forEach(section => {
      const items = enRecherche ? [] : Array.from(section.querySelectorAll('.guides-resource:not([hidden])'));
      const n = items.length;
      section.hidden = n === 0;
      const ouvert = replier ? ouverts.has(section) : !fermes.has(section);
      section.classList.toggle('guides-category--fermee', !ouvert);
      section.querySelector('.guides-resource-list').hidden = !ouvert;
      const note = section.querySelector('.guides-comm-note');
      if (note) note.hidden = !ouvert;
      section.querySelector('.guides-toggle').setAttribute('aria-expanded', String(ouvert));
      if (n) {
        section.classList.toggle('guides-band--green', visible++ % 2 === 1);
        badge(section.querySelector('.compte'), n, 'ressource');
      }
    });
    empty.hidden = count !== 0;
    if (recents) recents.hidden = !replier;
    if (communautaire) communautaire.hidden = !moteur.estCommunautaire(requete);
    effacerFiltres.hidden = !actifs.length;
    const libelles = actifs.map(s => s.value === SANS_ADRESSE ? 'lignes d’aide et services à distance' : s.value).join(' · ');
    status.textContent = pluriel(count, MOT) + (libelles ? ' · ' + libelles : '') + (requete ? ' pour « ' + requete + ' »' : ' dans le catalogue')
      + (horsMasques ? ' (' + horsMasques + ' hors territoire masqué' + (horsMasques > 1 ? 's' : '') + ')' : '');
    signalerAutrePage(requete);
  }

  /* Lien vers l'autre page quand la recherche y trouve aussi des fiches (ex. « dépendance »
     donne des guides et des organismes). Le catalogue complet n'est chargé qu'à la première
     recherche ; le classement mêle les deux types, comme avant la séparation des pages. */
  const autre = document.querySelector('.guides-autre');
  const autreLien = autre && autre.querySelector('a');
  let autreIndex = null;
  const chargerAutre = () => autreIndex || (autreIndex = fetch('/guides/donnees.json')
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(liste => {
      /* Organismes hors territoire exclus du compte : l'autre page les masque par défaut. */
      const fiches = liste.filter(f => (f.type === 'communautaire') !== (page === 'communautaire') && !/\(hors territoire\)$/.test(f.ville || ''));
      return fiches.map(f => preparer({
        comm: f.type === 'communautaire', titre: f.title, ville: (f.ville || '').replace(/ \(hors territoire\)$/, ''), org: f.org, cat: f.cat,
        rubriques: (f.rubriques || []).join(' '), tags: f.tags, desc: f.desc || ''
      }));
    })
    .catch(() => { autreIndex = null; return []; }));
  function signalerAutrePage(requete) {
    if (!autre) return;
    if (!requete) { autre.hidden = true; return; }
    chargerAutre().then(fiches => {
      if (input.value.trim() !== requete || !fiches.length) return;
      const tous = index.concat(fiches);
      const types = communautaires.concat(fiches.map(() => page !== 'communautaire'));
      const n = moteur.rechercherParType(tous, types, requete, { seuil: 0.25 }).filter(x => x.i >= index.length).length;
      autre.hidden = n === 0;
      if (!n) return;
      const s = n > 1 ? 's' : '';
      const quoi = page === 'communautaire' ? `${n} guide${s} clinique${s}` : `${n} organisme${s} communautaire${s}`;
      autreLien.textContent = `${quoi} correspond${n > 1 ? 'ent' : ''} aussi à « ${requete} » →`;
      autreLien.href = document.body.dataset.autrePage + '?q=' + encodeURIComponent(requete);
    });
  }
  /* La recherche en cours est gardée dans l'adresse (?q=) : on peut la partager, la mettre en
     favori du navigateur ou revenir en arrière sans la perdre. */
  const majAdresse = () => {
    try {
      const url = new URL(location.href);
      const q = input.value.trim();
      if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
      if (url.href !== location.href) history.replaceState(history.state, '', url);
    } catch (e) { /* adresse non modifiable : sans effet sur la recherche */ }
  };
  let minuterie = null;
  input.addEventListener('input', () => { clearTimeout(minuterie); minuterie = setTimeout(() => { render(); majAdresse(); }, 120); });
  /* Touche « / » : place le curseur dans la recherche (sauf pendant une saisie ailleurs). */
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    const cible = event.target;
    if (cible && (cible.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName))) return;
    event.preventDefault();
    input.focus();
    input.select();
  });
  form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(minuterie); render(); majAdresse(); });
  filtres.forEach(sel => sel.addEventListener('change', render));
  if (caseHors) caseHors.addEventListener('change', render);
  effacerFiltres.addEventListener('click', () => { filtres.forEach(s => { s.value = ''; }); render(); filtres[0].focus(); });
  document.querySelector('.guides-reset').addEventListener('click', () => {
    input.value = ''; filtres.forEach(s => { s.value = ''; });
    if (caseHors) caseHors.checked = true;
    render(); majAdresse(); input.focus();
  });
  /* Pour l'aiguillage IA (guides-aiguillage.js) : présélection par le moteur du site et
     cartes identiques à celles du catalogue, avec leur étoile de favori. */
  window.GuidesCatalogue = {
    /* Sans seuil de pertinence : l'IA gagne à voir large, jusqu'à n guides. */
    candidats: (question, n) => classer(question, 0).slice(0, n).map(({ i }) => resources[i].id),
    carte: id => (parId.has(id) ? cloner(id) : null),
    estCommunautaire: question => moteur.estCommunautaire(question),
    noteCommunautaire: () => (communautaire ? communautaire.cloneNode(true) : null),
    page
  };
  input.value = new URLSearchParams(location.search).get('q') || '';
  render();
  ouvrirDepuisAncre();
})();
