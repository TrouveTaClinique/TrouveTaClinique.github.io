/* Recherche du bandeau — Trouve ta clinique
   Cliquez la loupe : un panneau s’ouvre, les résultats filtrent au fur et à mesure.
   Sans JavaScript, la loupe mène à /recherche/. */
(function () {
  var INDEX_URL = '/recherche/donnees.json';
  var index = null;
  var indexCharge = false;
  var indexErreur = false;
  var chargement = null;

  function norm(s) {
    return String(s || '')
      .replace(/\u0153/g, 'oe').replace(/\u0152/g, 'oe')
      .replace(/\u00e6/g, 'ae').replace(/\u00c6/g, 'ae')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function chargerIndex() {
    if (indexCharge) return Promise.resolve(index);
    if (chargement) return chargement;
    chargement = fetch(INDEX_URL, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) {
          indexErreur = true;
          return [];
        }
        return r.json();
      })
      .then(function (data) {
        index = Array.isArray(data) ? data : (data.items || []);
        indexCharge = true;
        return index;
      })
      .catch(function () {
        index = [];
        indexCharge = true;
        indexErreur = true;
        return index;
      });
    return chargement;
  }

  function filtrer(q) {
    var mots = norm(q).trim().split(/\s+/).filter(function (m) { return m.length >= 1; });
    if (!mots.length || !index) return [];
    var resultat = [];
    for (var i = 0; i < index.length; i++) {
      var it = index[i];
      var hay = it._n || (it._n = norm([it.nom, it.ville, it.type, it.extra, it.rls].join(' ')));
      var ok = true;
      for (var m = 0; m < mots.length; m++) {
        if (hay.indexOf(mots[m]) === -1) { ok = false; break; }
      }
      if (!ok) continue;
      var nomN = norm(it.nom);
      var score = 0;
      if (nomN === mots.join(' ')) score = 300;
      else if (nomN.indexOf(mots[0]) === 0) score = 200;
      else if (nomN.indexOf(mots[0]) !== -1) score = 100;
      else score = 10;
      resultat.push({ it: it, score: score });
    }
    resultat.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.it.nom).localeCompare(String(b.it.nom), 'fr');
    });
    return resultat.map(function (r) { return r.it; });
  }

  function libelleType(t) {
    if (t === 'clinique') return 'Clinique';
    if (t === 'etablissement') return 'Établissement';
    if (t === 'rls') return 'Réseau local';
    return 'Page';
  }

  function htmlItem(it) {
    var meta = [];
    if (it.ville) meta.push(esc(it.ville));
    if (it.rls) meta.push(esc(it.rls));
    var sous = meta.length ? '<span class="search-hit__meta">' + meta.join(' · ') + '</span>' : '';
    return '<li><a class="search-hit" href="' + esc(it.url) + '">' +
      '<span class="search-hit__type">' + esc(libelleType(it.kind)) + '</span>' +
      '<span class="search-hit__nom">' + esc(it.nom) + '</span>' +
      sous +
      '</a></li>';
  }

  function afficher(listeEl, statutEl, q, limite) {
    if (!listeEl) return;
    var texte = (q || '').trim();
    if (texte.length < 2) {
      listeEl.innerHTML = '';
      if (statutEl) statutEl.textContent = 'Tapez au moins deux lettres (nom, ville ou secteur).';
      return;
    }
    if (!indexCharge) {
      listeEl.innerHTML = '';
      if (statutEl) statutEl.textContent = 'Chargement de la liste…';
      return;
    }
    if (indexErreur) {
      listeEl.innerHTML = '';
      if (statutEl) statutEl.textContent = 'La liste n’a pas pu se charger. Réessayez dans un instant.';
      return;
    }
    var items = filtrer(texte);
    var n = items.length;
    var vus = limite ? items.slice(0, limite) : items;
    listeEl.innerHTML = vus.map(htmlItem).join('');
    if (statutEl) {
      if (!n) statutEl.textContent = 'Aucun résultat pour « ' + texte + ' ».';
      else if (limite && n > limite) statutEl.textContent = n + ' résultats — les ' + limite + ' plus proches :';
      else statutEl.textContent = n === 1 ? '1 résultat' : n + ' résultats';
    }
  }

  function qs(id) { return document.getElementById(id); }

  function initPanneau() {
    var toggle = qs('search-toggle');
    if (!toggle) return;
    var panel = qs('search-panel');
    // Les guides et certains anciens gabarits n'embarquent pas le panneau.
    // Le composant commun le crée une seule fois, sans imposer une navigation.
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'search-panel';
      panel.className = 'search-panel';
      panel.hidden = true;
      panel.innerHTML = '<div class="search-panel__dialog" role="dialog" aria-modal="true" aria-labelledby="search-panel-title">' +
        '<div class="search-panel__top"><h2 id="search-panel-title">Rechercher un milieu</h2>' +
        '<button class="search-panel__close" id="search-close" type="button" aria-label="Fermer la recherche">×</button></div>' +
        '<form class="search-panel__form" id="search-form" action="/recherche/" method="get" role="search">' +
        '<label class="visually-hidden" for="search-input">Rechercher une clinique, un établissement, une ville ou un guide</label>' +
        '<input id="search-input" type="search" name="q" placeholder="Clinique, hôpital, ville…" autocomplete="off">' +
        '<button type="submit">Rechercher</button></form>' +
        '<p class="search-panel__hint" id="search-status" role="status" aria-live="polite"></p>' +
        '<ul class="search-hits" id="search-results"></ul>' +
        '<p class="search-panel__page-link"><a href="/recherche/">Ouvrir la recherche complète →</a></p></div>';
      document.body.appendChild(panel);
    }
    var input = qs('search-input');
    var results = qs('search-results');
    var status = qs('search-status');
    var closeBtn = qs('search-close');
    if (!toggle || !panel || !input) return;
    var pageLinkBlock = panel.querySelector('.search-panel__page-link');
    var pageLink = pageLinkBlock && pageLinkBlock.querySelector('a');
    var searchForm = qs('search-form');
    if (pageLinkBlock && searchForm) searchForm.parentNode.insertBefore(pageLinkBlock, searchForm);
    if (status) { status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); }
    toggle.setAttribute('aria-haspopup', 'dialog');
    var inertElements = [];

    function majLienComplet() {
      if (pageLink) pageLink.href = '/recherche/' + (input.value.trim() ? '?q=' + encodeURIComponent(input.value.trim()) : '');
    }

    function ouvert() {
      return !panel.hasAttribute('hidden');
    }

    function ouvrir(e) {
      if (e) e.preventDefault();
      panel.removeAttribute('hidden');
      inertElements = Array.from(document.body.children).filter(function (el) {
        return el !== panel && !el.contains(panel) && !el.inert;
      });
      inertElements.forEach(function (el) { el.inert = true; });
      document.body.classList.add('search-open');
      toggle.setAttribute('aria-expanded', 'true');
      input.focus();
      input.select();
      majLienComplet();
      chargerIndex().then(function () {
        afficher(results, status, input.value, 8);
      });
    }

    function fermer() {
      if (!ouvert()) return;
      panel.setAttribute('hidden', '');
      inertElements.forEach(function (el) { el.inert = false; });
      inertElements = [];
      document.body.classList.remove('search-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }

    toggle.addEventListener('click', function (e) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      if (ouvert()) { e.preventDefault(); fermer(); }
      else ouvrir(e);
    });
    if (closeBtn) closeBtn.addEventListener('click', fermer);
    panel.addEventListener('click', function (e) {
      if (e.target === panel) fermer();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ouvert()) {
        e.preventDefault();
        fermer();
      }
      if (e.key === 'Tab' && ouvert()) {
        var controls = Array.from(panel.querySelectorAll('a[href],button,input')).filter(function (el) {
          return !el.disabled && el.getClientRects().length;
        });
        var first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    input.addEventListener('input', function () {
      majLienComplet();
      afficher(results, status, input.value, 8);
    });
    var form = qs('search-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        afficher(results, status, input.value, 8);
      });
    }
    // Chargement à la première ouverture seulement.
  }

  function initPage() {
    var input = qs('search-page-input');
    var results = qs('search-page-results');
    var status = qs('search-page-status');
    if (!input || !results) return;
    function maj() { afficher(results, status, input.value, 0); }
    chargerIndex().then(function () {
      var params = new URLSearchParams(location.search);
      var q = params.get('q');
      if (q && !input.value) input.value = q;
      maj();
    });
    input.addEventListener('input', maj);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initPanneau();
      initPage();
    });
  } else {
    initPanneau();
    initPage();
  }
})();
