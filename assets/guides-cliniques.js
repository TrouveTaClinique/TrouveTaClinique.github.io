/* La liste et les liens sont présents dans le HTML, même sans JavaScript. */
(function () {
  'use strict';
  const input = document.getElementById('guide-search');
  if (!input) return;
  const form = document.querySelector('.guides-search-form');
  const moteur = window.GuidesRecherche;
  const sections = Array.from(document.querySelectorAll('.guides-category'));
  const status = document.getElementById('guide-status');
  const empty = document.querySelector('.guides-empty');
  const communautaire = document.querySelector('.guides-communautaire');
  const selSujet = document.getElementById('guides-filtre-sujet');
  const selOrganisme = document.getElementById('guides-filtre-organisme');
  const effacerFiltres = document.querySelector('.guides-filtres-reset');
  const resSection = document.querySelector('.guides-resultats');
  const resList = resSection.querySelector('.guides-resource-list');
  const resources = Array.from(document.querySelectorAll('#guides-catalogue .guides-resource')).map(el => ({
    el, id: el.dataset.id, category: el.dataset.category, org: el.dataset.org, comm: el.dataset.type === 'communautaire'
  }));
  if (!moteur || !selSujet) return; // la liste complète reste affichée
  /* Organismes communautaires : leur source commune (le bottin) n'est pas cherchée, leur ville
     compte comme le nom et leur rubrique comme une catégorie. */
  const index = resources.map(r => moteur.preparer({
    titre: r.comm ? r.el.dataset.title + ' ' + r.el.dataset.ville : r.el.dataset.title, organisme: r.comm ? '' : r.org,
    categorie: r.comm ? r.category + ' ' + r.el.dataset.rubriques : r.category,
    motsCles: r.el.dataset.tags, description: r.el.dataset.desc
  }));
  const communautaires = resources.map(r => r.comm);
  const classer = (requete, seuil) => moteur.rechercherParType(index, communautaires, requete, { seuil });
  document.querySelector('.guides-filter-area').hidden = false;

  /* Favoris : gardés dans ce navigateur seulement (localStorage), sans compte ni
     synchronisation. La clé contient les URL des ressources, dans l'ordre d'ajout. */
  const CLE_FAVORIS = 'ttc-guides-favoris';
  const favSection = document.querySelector('.guides-favoris');
  const favList = favSection.querySelector('.guides-resource-list');
  const parId = new Map(resources.map(r => [r.el.dataset.id, r]));
  const lireFavoris = () => {
    try {
      const v = JSON.parse(localStorage.getItem(CLE_FAVORIS) || '[]');
      return Array.isArray(v) ? v.filter(id => parId.has(id)) : [];
    } catch (e) { return []; }
  };
  let favoris = lireFavoris();
  const enregistrer = () => { try { localStorage.setItem(CLE_FAVORIS, JSON.stringify(favoris)); } catch (e) { /* stockage bloqué : favoris pour cette visite seulement */ } };
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
    favoris = favoris.includes(id) ? favoris.filter(f => f !== id) : [id, ...favoris];
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
    favoris = lireFavoris(); construireFavoris(); render();
  });

  /* Sans recherche ni filtre, les sujets sont fermés : leur titre est un bouton qui ouvre la
     liste. Une recherche ou un filtre les ouvre tous. Sans JavaScript, tout reste affiché. */
  const titreCatalogue = document.querySelector('.guides-catalogue-titre');
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

  const badge = (el, n, mot) => { el.textContent = n; el.setAttribute('aria-label', n + ' ' + mot + (n > 1 ? 's' : '')); };

  function render() {
    const requete = input.value.trim();
    const sujet = selSujet.value, organisme = selOrganisme.value;
    const retenus = new Map(); // id -> score
    classer(requete, 0.25).forEach(({ i, score }) => {
      const r = resources[i];
      if ((!sujet || r.category === sujet) && (!organisme || r.org === organisme)) retenus.set(r.id, score);
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
    replier = !requete && !sujet && !organisme;
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
    communautaire.hidden = !moteur.estCommunautaire(requete);
    effacerFiltres.hidden = !sujet && !organisme;
    const filtres = [sujet, organisme].filter(Boolean).join(' · ');
    status.textContent = count + ' ressource' + (count > 1 ? 's' : '') + (filtres ? ' · ' + filtres : '') + (requete ? ' pour « ' + requete + ' »' : ' dans le catalogue');
  }
  let minuterie = null;
  input.addEventListener('input', () => { clearTimeout(minuterie); minuterie = setTimeout(render, 120); });
  form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(minuterie); render(); });
  [selSujet, selOrganisme].forEach(sel => sel.addEventListener('change', render));
  effacerFiltres.addEventListener('click', () => { selSujet.value = ''; selOrganisme.value = ''; render(); selSujet.focus(); });
  document.querySelector('.guides-reset').addEventListener('click', () => {
    input.value = ''; selSujet.value = ''; selOrganisme.value = '';
    render(); input.focus();
  });
  /* Pour l'aiguillage IA (guides-aiguillage.js) : présélection par le moteur du site et
     cartes identiques à celles du catalogue, avec leur étoile de favori. */
  window.GuidesCatalogue = {
    /* Sans seuil de pertinence : l'IA gagne à voir large, jusqu'à n guides. */
    candidats: (question, n) => classer(question, 0).slice(0, n).map(({ i }) => resources[i].id),
    carte: id => (parId.has(id) ? cloner(id) : null),
    estCommunautaire: question => moteur.estCommunautaire(question),
    noteCommunautaire: () => communautaire.cloneNode(true)
  };
  input.value = new URLSearchParams(location.search).get('q') || '';
  render();
  ouvrirDepuisAncre();
})();
