// Shared header, tab bar and footer for every page. Include with: <script src="assets/shell.js" data-root="" data-active="overview"></script>
(function () {
  const s = document.currentScript, root = s.dataset.root || '', active = s.dataset.active || '';
  const head = document.head, de = document.documentElement;
  let theme = 'dark'; try { theme = localStorage.getItem('aiethos-theme') || 'dark'; } catch (e) {}
  de.setAttribute('data-theme', theme);
  if (!document.querySelector('meta[name=viewport]')) head.insertAdjacentHTML('beforeend', '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
  head.insertAdjacentHTML('beforeend', '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap">');
  const I = {
    overview: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
    countries: '<path d="M5 21V4M5 5h11l-2 4 2 4H5"/>',
    rules: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
    datacentres: '<rect x="4" y="4" width="16" height="6" rx="1"/><rect x="4" y="14" width="16" height="6" rx="1"/><path d="M8 7h.01M8 17h.01"/>',
    research: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>'
  };
  const T = [['overview', 'Overview', 'index.html'], ['countries', 'Countries', 'index.html#/countries'], ['rules', 'Rules', 'index.html#/rules'], ['datacentres', 'Data centres', 'index.html#/datacentres'], ['research', 'Research', 'scholarly.html']];
  const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>';
  const html = `<a class="skip" href="#main">Skip to content</a><header class="top"><div class="top-in"><a class="brand" href="${root}index.html"><b>AIETHOS</b><span>AI Ethics Observatory</span></a><div class="top-r"><button type="button" class="theme" id="themeBtn"></button></div></div></header>` +
    `<nav class="tabs" aria-label="Main"><ul>${T.map(([k, l, h]) => `<li><a href="${root}${h}" data-k="${k}"${k === active ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>${l}</a></li>`).join('')}</ul></nav>`;
  document.body.insertAdjacentHTML('afterbegin', html);
  const btn = document.getElementById('themeBtn');
  const paint = () => { const t = de.getAttribute('data-theme'); btn.innerHTML = t === 'dark' ? SUN : MOON; btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'); };
  btn.addEventListener('click', () => { const t = de.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; de.setAttribute('data-theme', t); try { localStorage.setItem('aiethos-theme', t); } catch (e) {} paint(); document.dispatchEvent(new Event('aiethos-theme')); });
  paint();
  const foot = () => document.body.insertAdjacentHTML('beforeend', `<footer class="foot"><div class="brand-l">AIETHOS</div><p>AI Ethics Observatory. Global regulatory intelligence, traced to its sources.</p><p>Powered by <a href="https://andymiah.net" rel="noopener">Prof Andy Miah</a></p><div class="links"><a href="${root}index.html#/about">About and method</a><a href="${root}scholarly.html">Research map</a><a href="${root}index.html#/rules/library">Document library</a></div></footer>`);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', foot); else foot();
  window.AIETHOS_SHELL = { setActive(k) { document.querySelectorAll('.tabs a').forEach(a => { if (a.dataset.k === k) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); } };
})();
