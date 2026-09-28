/* Modules PABP (FMPE) : accès réservé aux résidents, en préparation.
   En attendant l'accord écrit de la FMPE, les fiches mènent à la page des modules de la FMPE.
   Sur l'aperçu seulement (apercu.trouvetaclinique.ca, ou en local), un clic sur une fiche PABP
   ouvre une confirmation « Je suis résident(e) » puis un PDF de démonstration : aucun module
   n'est publié. Une fois l'accord obtenu : ajouter les PDF dans guides/pabp/<slug>.pdf et
   remplacer PDF_DEMO par le chemin du module (voir urlModule).
   La case cochée est gardée dans ce navigateur (localStorage) ; c'est une déclaration, pas un
   contrôle d'identité. */
(function () {
  'use strict';
  const hote = location.hostname;
  const actif = /^apercu\./.test(hote) || hote === 'localhost' || hote === '127.0.0.1';
  if (!actif || !window.HTMLDialogElement) return;
  const CLE = 'ttc-pabp-resident';
  const PDF_DEMO = '/guides/pabp/apercu-module.pdf';
  const urlModule = slug => PDF_DEMO + '#' + encodeURIComponent(slug);
  const confirme = () => { try { return localStorage.getItem(CLE) === '1'; } catch (e) { return false; } };
  const memoriser = () => { try { localStorage.setItem(CLE, '1'); } catch (e) { /* stockage bloqué */ } };

  /* Les fiches PABP affichent l'accès prévu plutôt que « Réservé aux participants PABP ». */
  const etiqueter = racine => racine.querySelectorAll('li[data-pabp] .guides-acces').forEach(el => { el.textContent = 'Résidents : accès sur confirmation'; });
  etiqueter(document);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) etiqueter(n); })))
    .observe(document.body, { childList: true, subtree: true });

  let dialogue = null;
  function ouvrirDialogue(slug, titre) {
    if (!dialogue) {
      dialogue = document.createElement('dialog');
      dialogue.className = 'guides-pabp-dialogue';
      dialogue.setAttribute('aria-labelledby', 'pabp-titre');
      dialogue.innerHTML = `<form method="dialog" class="guides-pabp-form">
  <h2 id="pabp-titre">Module réservé aux résidents</h2>
  <p class="guides-pabp-module"></p>
  <p>Les modules du Programme d’apprentissage basé sur la pratique (PABP) sont offerts aux résidents en médecine familiale, avec l’accord de la Fondation pour l’éducation médicale continue (FMPE).</p>
  <label class="guides-case"><input type="checkbox" required> Je confirme être résident(e) en médecine familiale.</label>
  <p class="guides-pabp-note">Aperçu : un document de démonstration s’ouvrira à la place du module.</p>
  <div class="guides-pabp-actions">
    <button type="submit" value="annuler" formnovalidate class="btn ghost">Annuler</button>
    <button type="submit" value="ok" class="btn">Accéder au module</button>
  </div>
</form>`;
      document.body.append(dialogue);
      dialogue.addEventListener('close', () => {
        if (dialogue.returnValue !== 'ok') return;
        memoriser();
        window.open(urlModule(dialogue.dataset.slug), '_blank', 'noopener');
      });
    }
    dialogue.dataset.slug = slug;
    dialogue.querySelector('.guides-pabp-module').textContent = titre;
    dialogue.querySelector('input[type="checkbox"]').checked = false;
    dialogue.returnValue = '';
    dialogue.showModal();
  }

  document.addEventListener('click', event => {
    const lien = event.target.closest('li[data-pabp] .guides-resource-link');
    if (!lien || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const fiche = lien.closest('li[data-pabp]');
    event.preventDefault();
    if (confirme()) { window.open(urlModule(fiche.dataset.pabp), '_blank', 'noopener'); return; }
    ouvrirDialogue(fiche.dataset.pabp, fiche.dataset.title || '');
  });
})();
