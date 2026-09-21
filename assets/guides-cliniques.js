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

  function render() {
    const words = norm(input.value.trim()).split(/\s+/).filter(Boolean);
    let count = 0;
    resources.forEach(r => {
      const match = (category === 'Toutes' || r.category === category) && words.every(word => r.text.includes(word));
      r.el.hidden = !match;
      if (match) count++;
    });
    let visible = 0;
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
