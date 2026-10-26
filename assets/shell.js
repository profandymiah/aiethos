// Shared header and tab bar for every page. Include with: <script src="assets/shell.js" data-root="" data-active="countries"></script>
(function () {
  const s = document.currentScript, root = s.dataset.root || '', active = s.dataset.active || '';
  const head = document.head;
  if (!document.querySelector('meta[name=viewport]')) head.insertAdjacentHTML('beforeend', '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
  head.insertAdjacentHTML('beforeend', '<meta name="color-scheme" content="light dark"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap">');
  const I = {
    countries: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
    rules: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
    datacentres: '<rect x="4" y="4" width="16" height="6" rx="1"/><rect x="4" y="14" width="16" height="6" rx="1"/><path d="M8 7h.01M8 17h.01"/>',
    research: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'
  };
  const T = [['countries', 'Countries', 'index.html#/'], ['rules', 'Rules', 'index.html#/rules'], ['datacentres', 'Data centres', 'index.html#/datacentres'], ['research', 'Research', 'scholarly.html'], ['more', 'More', 'index.html#/more']];
  const html = `<a class="skip" href="#main">Skip to content</a><header class="top"><div class="top-in"><a class="brand" href="${root}index.html#/"><b>AIETHOS</b><span>AI Ethics Observatory</span></a></div></header>` +
    `<nav class="tabs" aria-label="Main"><ul>${T.map(([k, l, h]) => `<li><a href="${root}${h}" data-k="${k}"${k === active ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>${l}</a></li>`).join('')}</ul></nav>`;
  document.body.insertAdjacentHTML('afterbegin', html);
  window.AIETHOS_SHELL = { setActive(k) { document.querySelectorAll('.tabs a').forEach(a => { if (a.dataset.k === k) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); } };
})();
