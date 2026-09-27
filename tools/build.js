// Assemble une version autonome (un seul fichier HTML, scripts locaux intégrés) : node tools/build.js
// → dist/atelier-treillis.html (version publiable, sans l'enveloppe <html>/<head>/<body> que l'hébergeur ajoute)
// → dist/atelier-treillis-autonome.html (version complète à ouvrir directement dans un navigateur)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8');
  if (/<\/script/i.test(code)) throw new Error(`« </script » présent dans ${src}`);
  return `<script>\n/* ${src} */\n${code}\n</script>`;
});
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'atelier-treillis-autonome.html'), html);
const bare = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '')
  .replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '')
  .replace(/<\/body>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
fs.writeFileSync(path.join(root, 'dist', 'atelier-treillis.html'), bare);
console.log('dist/atelier-treillis.html', (bare.length / 1024).toFixed(0), 'Ko');
console.log('dist/atelier-treillis-autonome.html', (html.length / 1024).toFixed(0), 'Ko');
