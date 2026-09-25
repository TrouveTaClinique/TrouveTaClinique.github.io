/* La liste et les liens sont présents dans le HTML, même sans JavaScript. */
(function () {
  'use strict';
  const input = document.getElementById('guide-search');
  if (!input) return;
  const form = document.querySelector('.guides-search-form');
  const filters = Array.from(document.querySelectorAll('.guides-filter'));
  const sections = Array.from(document.querySelectorAll('.guides-category'));
  const status = document.getElementById('guide-status');
  const empty = document.querySelector('.guides-empty');
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/œ/g, 'oe').toLowerCase();
  const resources = Array.from(document.querySelectorAll('.guides-resource')).map(el => ({el, category:el.dataset.category, text:norm(el.dataset.search)}));
  let category = 'Toutes';
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
  function construireFavoris() {
    favList.replaceChildren(...favoris.map(id => {
      const clone = parId.get(id).el.cloneNode(true);
      clone.hidden = false;
      clone.querySelector('.guides-fav').remove();
      ajouterEtoile(clone);
      return clone;
    }));
    document.querySelectorAll('#guides-catalogue .guides-fav').forEach(b => majEtoile(b, b.parentElement.dataset.id));
  }
  resources.forEach(r => ajouterEtoile(r.el));
  construireFavoris();
  window.addEventListener('storage', event => {
    if (event.key !== CLE_FAVORIS) return;
    favoris = lireFavoris(); construireFavoris(); render();
  });

  function render() {
    const words = norm(input.value.trim()).split(/\s+/).filter(Boolean);
    let count = 0;
    resources.forEach(r => {
      const match = (category === 'Toutes' || r.category === category) && words.every(word => r.text.includes(word));
      r.el.hidden = !match;
      if (match) count++;
    });
    /* Les favoris suivent la même recherche et le même filtre que le catalogue. */
    let favVisibles = 0;
    favList.querySelectorAll('.guides-resource').forEach(li => {
      li.hidden = parId.get(li.dataset.id).el.hidden;
      if (!li.hidden) favVisibles++;
    });
    favSection.hidden = favVisibles === 0;
    const badgeFav = favSection.querySelector('.compte');
    badgeFav.textContent = favVisibles;
    badgeFav.setAttribute('aria-label', favVisibles + ' favori' + (favVisibles > 1 ? 's' : ''));
    let visible = favVisibles ? 1 : 0;
    sections.forEach(section => {
      const n = section.querySelectorAll('.guides-resource:not([hidden])').length;
      section.hidden = n === 0;
      if (n) {
        section.classList.toggle('guides-band--green', visible++ % 2 === 1);
        const badge = section.querySelector('.compte');
        badge.textContent = n;
        badge.setAttribute('aria-label', n + ' ressource' + (n > 1 ? 's' : ''));
      }
    });
    empty.hidden = count !== 0;
    status.textContent = count + ' ressource' + (count > 1 ? 's' : '') + (category !== 'Toutes' ? ' · ' + category : '') + (input.value.trim() ? ' pour « ' + input.value.trim() + ' »' : ' dans le catalogue');
  }
  filters.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.category;
    filters.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    render();
  }));
  input.addEventListener('input', render);
  form.addEventListener('submit', event => { event.preventDefault(); render(); });
  document.querySelector('.guides-reset').addEventListener('click', () => {
    input.value = ''; category = 'Toutes';
    filters.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.category === 'Toutes')));
    render(); input.focus();
  });
  input.value = new URLSearchParams(location.search).get('q') || '';
  render();
})();
