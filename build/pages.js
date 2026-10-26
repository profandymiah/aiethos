// Generates one static page per jurisdiction at country/<id>/index.html (content is rendered client-side by assets/country.js).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const list = JSON.parse(fs.readFileSync(path.join(root, 'data/jurisdictions.json'), 'utf8')).jurisdictions;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
for (const j of list) {
  const m = j.meta || j; const id = m.id || j.id, name = m.name || j.name;
  const dir = path.join(root, 'country', id); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(name)} · AI ethics and governance · AIETHOS</title>
<meta name="description" content="How ${esc(name)} governs artificial intelligence: the law, the gaps, your rights, the sources and community notes. AIETHOS, AI Ethics Observatory.">
<link rel="canonical" href="https://aiethos.andymiah.net/country/${id}/">
<link rel="stylesheet" href="../../assets/app.css"><link rel="stylesheet" href="../../assets/country.css">
</head><body data-c="${id}">
<script src="../../assets/shell.js" data-root="../../" data-active="countries"></script>
<main class="wrap" id="main" tabindex="-1"><div id="cp"><p class="note" style="margin-top:28px">Loading ${esc(name)}…</p></div></main>
<noscript><p class="msg">This page needs JavaScript to show the ${esc(name)} entry.</p></noscript>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="../../assets/config.js"></script><script src="../../assets/notes.js"></script><script src="../../assets/country.js"></script>
</body></html>`);
}
console.log('pages:', list.length);
