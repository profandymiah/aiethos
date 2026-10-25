// Generates assets/site.css (from index.html tokens/styles) and one static page per jurisdiction at country/<id>/index.html.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = (idx.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'assets/site.css'), css);
const list = JSON.parse(fs.readFileSync(path.join(root, 'data/jurisdictions.json'), 'utf8')).jurisdictions;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
for (const j of list) {
  const m = j.meta || j; const id = m.id || j.id, name = m.name || j.name;
  const dir = path.join(root, 'country', id); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(name)} · AI ethics and governance · AIETHOS</title>
<meta name="description" content="How ${esc(name)} governs artificial intelligence: the law, the gaps, your rights, the sources and community notes. AIETHOS, AI Ethics Observatory.">
<link rel="canonical" href="https://aiethos.andymiah.net/country/${id}/">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600&family=JetBrains+Mono:wght@300;400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../../assets/site.css"><link rel="stylesheet" href="../../assets/country.css">
</head><body data-c="${id}"><main class="cp" id="cp"><p class="cp-note">Loading ${esc(name)}…</p></main>
<noscript><p class="cp-msg">This page needs JavaScript to show the ${esc(name)} entry.</p></noscript>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="../../assets/config.js"></script><script src="../../assets/notes.js"></script><script src="../../assets/country.js"></script>
</body></html>`);
}
console.log('pages:', list.length);
