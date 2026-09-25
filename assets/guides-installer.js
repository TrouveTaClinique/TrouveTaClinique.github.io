/* Application « Guides » : enregistrement du service worker (portée /guides/) et bouton Installer. */
(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/guides/sw.js', { scope: '/guides/', updateViaCache: 'none' })
        .then(function (enr) { enr.update().catch(function () {}); })
        .catch(function () {});
    });
  }

  var bloc = document.getElementById('guides-app');
  var bouton = document.getElementById('guides-app-installer');
  var aide = document.getElementById('guides-app-aide');
  if (!bloc || !bouton || !aide) return;

  var ua = navigator.userAgent || '';
  var estIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var estTelephone = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || estIOS;
  var enApplication = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
  var invite = null;

  if (enApplication) return;          // déjà ouverte comme application : rien à proposer
  bloc.hidden = false;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    invite = e;
  });

  function montrerAide(html) {
    aide.innerHTML = html;
    aide.hidden = false;
  }

  bouton.addEventListener('click', function () {
    if (invite) {
      invite.prompt();
      invite.userChoice.catch(function () {}).then(function () { invite = null; });
      return;
    }
    if (estIOS) {
      montrerAide('Dans Safari, touchez <b>Partager</b>, puis <b>« Sur l’écran d’accueil »</b>.');
    } else if (estTelephone) {
      montrerAide('Dans Chrome, touchez le menu <b>⋮</b>, puis <b>« Installer l’application »</b> ou <b>« Ajouter à l’écran d’accueil »</b>.');
    } else {
      montrerAide('Dans Chrome ou Edge, cliquez sur l’icône d’installation à droite de la barre d’adresse. Si elle n’y est pas, l’application est peut-être déjà installée.');
    }
  });

  window.addEventListener('appinstalled', function () {
    bloc.hidden = true;
  });
})();
