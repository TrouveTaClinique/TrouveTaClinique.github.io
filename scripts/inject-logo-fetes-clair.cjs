const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const b64 = fs.readFileSync(path.join(root, 'assets/source/logo-fetes-clair.png')).toString('base64');
const fetesDecl =
  "  /* Épingle fêtes (bonnet rouge), détourée — en-tête en mode clair, 1er déc.–1er janv. */\n" +
  `  --app-logo-fetes: url(data:image/png;base64,${b64});`;

const cssFetes = `
/* Logo festif dans l'en-tête uniquement (mode clair, 1er décembre au 1er janvier). */
:root[data-logo-fetes]:not([data-theme="sombre"]) .logo-img {
  background-image: var(--app-logo-fetes);
}
:root[data-logo-fetes]:not([data-theme="sombre"]) .logo-img::after {
  -webkit-mask: var(--app-logo-fetes) center/contain no-repeat;
  mask: var(--app-logo-fetes) center/contain no-repeat;
}`;

const jsFetes = `
    if ((function () {
      var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montreal', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
      var m = 0, d = 0;
      for (var i = 0; i < p.length; i++) {
        if (p[i].type === 'month') m = +p[i].value;
        if (p[i].type === 'day') d = +p[i].value;
      }
      return m === 12 || (m === 1 && d === 1);
    })()) document.documentElement.dataset.logoFetes = '1';`;

for (const rel of ['scripts/carte.template.html', 'scripts/carte-est-sq.template.html']) {
  const file = path.join(root, rel);
  let html = fs.readFileSync(file, 'utf8');

  if (!html.includes('--app-logo-fetes')) {
    html = html.replace(
      /(--app-logo-sombre: url\(data:image\/png;base64,[^)]+\);)/,
      `$1\n${fetesDecl}`
    );
  }

  if (!html.includes('data-logo-fetes')) {
    html = html.replace(/(@keyframes logoReflet \{[^}]+\})/, `$1${cssFetes}`);
  }

  if (!html.includes('dataset.logoFetes')) {
    html = html.replace(
      /(document\.documentElement\.dataset\.theme = c;)/,
      `$1${jsFetes}`
    );
    html = html.replace(
      /(\} catch \(e\) \{ document\.documentElement\.dataset\.theme = 'clair'; \})/,
      `} catch (e) { document.documentElement.dataset.theme = 'clair';${jsFetes} }`
    );
  }

  fs.writeFileSync(file, html);
  console.log('patché', rel);
}
