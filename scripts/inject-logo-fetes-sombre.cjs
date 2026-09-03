const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const b64 = fs.readFileSync(path.join(root, 'assets/source/logo-fetes-sombre.png')).toString('base64');
const sombreDecl =
  "  /* Épingle fêtes (bonnet), détourée — mode sombre uniquement. */\n" +
  `  --app-logo-sombre: url(data:image/png;base64,${b64});`;
const darkOverride = '  --app-logo: var(--app-logo-sombre);';

const sombreRe = /  \/\* Épingle fêtes \(bonnet\), détourée — mode sombre uniquement\. \*\/\n  --app-logo-sombre: url\(data:image\/png;base64,[^)]+\);/;

const sombreBlock =
  /  \/\* Épingle fêtes \(bonnet\), détourée — mode sombre uniquement\. \*\/\n  --app-logo-sombre: url\(data:image\/png;base64,[^)]+\);\n?/g;

for (const rel of ['scripts/carte.template.html', 'scripts/carte-est-sq.template.html']) {
  const file = path.join(root, rel);
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(sombreBlock, '');
  if (html.includes('--app-logo: url(data:image/png;base64,')) {
    html = html.replace(
      /(--app-logo: url\(data:image\/png;base64,[^)]+\);)/,
      `$1\n${sombreDecl}`
    );
  } else if (sombreRe.test(html)) {
    html = html.replace(sombreRe, sombreDecl);
  } else {
    html = html.replace(/(--app-logo: url\(data:image\/png;base64,[^)]+\);)/, `$1\n${sombreDecl}`);
    html = html.replace(/(:root\[data-theme="sombre"\] \{[^]*?)(\n\})/, (m, head, tail) => {
      if (head.includes('--app-logo: var(--app-logo-sombre)')) return m;
      return `${head}\n${darkOverride}${tail}`;
    });
  }
  fs.writeFileSync(file, html);
  console.log('injecté', rel);
}
