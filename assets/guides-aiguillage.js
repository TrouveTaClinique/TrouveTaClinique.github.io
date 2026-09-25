/* Boîte « Demander à l'IA quel guide consulter » de /guides/.
   Le service d'aiguillage parcourt tout le catalogue ; le moteur du site lui envoie en indice
   ses 15 meilleurs résultats (window.GuidesCatalogue, dans guides-cliniques.js) ;
   le service d'aiguillage (workers/aiguillage) en choisit au plus 5 et explique chaque choix.
   Titres et liens viennent du catalogue, jamais de l'IA. */
(function () {
  'use strict';
  const section = document.querySelector('.guides-ia');
  const catalogue = window.GuidesCatalogue;
  if (!section || !section.dataset.url || !catalogue || !window.fetch) return;
  const form = section.querySelector('.guides-ia-form');
  const champ = section.querySelector('#guides-ia-question');
  const bouton = form.querySelector('button[type="submit"]');
  const zone = section.querySelector('.guides-ia-resultat');
  const CANDIDATS = 15;
  section.hidden = false;

  const paragraphe = (classe, texte) => {
    const p = document.createElement('p');
    p.className = classe;
    p.textContent = texte;
    return p;
  };

  function carte(guide) {
    const li = catalogue.carte(guide.url) || (() => {
      /* Guide absent de cette version de la page (catalogue mis à jour entre-temps) : lien simple. */
      const el = document.createElement('li');
      el.className = 'guides-resource';
      const a = document.createElement('a');
      a.className = 'guides-resource-link';
      a.href = guide.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.append(paragraphe('guides-resource-source', guide.organisme));
      const h3 = document.createElement('h3'); h3.textContent = guide.titre; a.append(h3);
      el.append(a);
      return el;
    })();
    const raison = document.createElement('p');
    raison.className = 'guides-ia-raison';
    const b = document.createElement('strong'); b.textContent = 'Pourquoi : ';
    raison.append(b, guide.raison);
    li.querySelector('.guides-resource-link').after(raison);
    return li;
  }

  function afficher(donnees) {
    zone.replaceChildren();
    if (donnees.message) zone.append(paragraphe('guides-ia-message', donnees.message));
    if (donnees.guides && donnees.guides.length) {
      const n = donnees.guides.length;
      zone.append(paragraphe('guides-ia-compte', n + ' suggestion' + (n > 1 ? 's' : '')));
      const ul = document.createElement('ul');
      ul.className = 'guides-resource-list';
      donnees.guides.forEach(g => ul.append(carte(g)));
      zone.append(ul, paragraphe('guides-ia-pied', 'Suggestions générées par IA à partir du catalogue. Consultez toujours la source elle-même.'));
    }
  }

  /* Question sur une ressource communautaire : même encadré 211 que la recherche. */
  const noteCommunautaire = () => { const n = catalogue.noteCommunautaire(); n.hidden = false; return n; };

  /* Attente animée : points qui rebondissent et étapes qui défilent. Le lecteur d'écran
     n'annonce qu'une phrase ; les étapes visibles lui sont masquées. */
  const ETAPES = ['L’IA lit le catalogue…', 'Analyse de la situation…', 'Choix des ressources les plus utiles…', 'Rédaction des explications…'];
  let minuterieEtapes = null;
  function attendre() {
    const el = (tag, classe) => { const e = document.createElement(tag); e.className = classe; return e; };
    const bloc = el('div', 'guides-ia-attente');
    const orbe = el('span', 'guides-ia-orbe');
    orbe.setAttribute('aria-hidden', 'true');
    orbe.append(el('span', 'guides-ia-anneau'), Object.assign(el('span', 'guides-ia-etoile'), { textContent: '✦' }));
    const colonne = el('span', 'guides-ia-attente-texte');
    const ligne = el('span', 'guides-ia-attente-ligne');
    const texte = el('span', 'guides-ia-etape');
    texte.setAttribute('aria-hidden', 'true');
    texte.textContent = ETAPES[0];
    const points = el('span', 'guides-ia-points');
    points.setAttribute('aria-hidden', 'true');
    points.append(el('span', ''), el('span', ''), el('span', ''));
    ligne.append(texte, points);
    const barre = el('span', 'guides-ia-barre');
    barre.setAttribute('aria-hidden', 'true');
    colonne.append(ligne, barre);
    const lu = el('span', 'visually-hidden');
    lu.textContent = 'Recherche en cours dans tout le catalogue.';
    bloc.append(orbe, colonne, lu);
    zone.replaceChildren(bloc);
    let n = 0;
    clearInterval(minuterieEtapes);
    let actuel = texte;
    minuterieEtapes = setInterval(() => {
      n = Math.min(n + 1, ETAPES.length - 1);
      const suivant = actuel.cloneNode(false);   // nouvel élément : le fondu se rejoue
      suivant.textContent = ETAPES[n];
      actuel.replaceWith(suivant);
      actuel = suivant;
      if (n === ETAPES.length - 1) clearInterval(minuterieEtapes);
    }, 2200);
  }

  const erreur = texte => { zone.replaceChildren(paragraphe('guides-ia-erreur', texte)); };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const question = champ.value.replace(/\s+/g, ' ').trim();
    if (question.length < 3) { erreur('Décrivez la situation en quelques mots.'); champ.focus(); return; }
    /* L'IA parcourt tout le catalogue ; la présélection du moteur de mots-clés, même vide,
       ne lui sert que d'indice. */
    const candidats = catalogue.candidats(question, CANDIDATS);
    const communautaire = catalogue.estCommunautaire && catalogue.estCommunautaire(question);
    bouton.disabled = true;
    section.setAttribute('aria-busy', 'true');
    attendre();
    try {
      const controleur = new AbortController();
      const minuterie = setTimeout(() => controleur.abort(), 45000);
      const reponse = await fetch(section.dataset.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, candidats }),
        signal: controleur.signal
      });
      clearTimeout(minuterie);
      const donnees = await reponse.json().catch(() => ({}));
      if (!reponse.ok) {
        erreur(donnees.erreur || 'Le service est indisponible pour le moment. La recherche ci-dessus fonctionne toujours.');
      } else {
        afficher(donnees);
        if (communautaire) zone.prepend(noteCommunautaire());
      }
    } catch (e) {
      erreur('Le service n’a pas répondu. Vérifiez votre connexion ou réessayez dans un moment ; la recherche ci-dessus fonctionne toujours.');
    } finally {
      clearInterval(minuterieEtapes);
      bouton.disabled = false;
      section.removeAttribute('aria-busy');
    }
  });
})();
