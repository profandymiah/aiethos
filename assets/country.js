(async function () {
  const id = document.body.dataset.c;
  const N = window.AIETHOS_NOTES, esc = N.esc, root = document.getElementById('cp');
  const get = async u => { try { const r = await fetch('../../' + u); return r.ok ? r.json() : null; } catch (e) { return null; } };
  const [j, scores, lib, dc, sch] = await Promise.all([get(`data/jurisdictions/${id}.json`), get('data/ethics-scores.json'), get('data/library.json'), get('data/global/datacentres.json'), get('data/scholarly.json')]);
  if (!j) { root.innerHTML = '<p class="cp-msg err">This entry could not be loaded.</p>'; return; }
  const m = j.meta, f = j.framework, r = j.research, c = j.citizen, ev = j.evidence;
  const fmt = d => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'not set';
  const srcDates = ((ev && ev.sources) || []).map(s => s.date).filter(Boolean).sort();
  const latestSrc = srcDates[srcDates.length - 1];
  const prov = ev && !(ev.sources || []).some(s => s.type === 'primary');
  const list = a => (a && a.length) ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  let h = `<div class="cp-top"><a href="../../index.html#regulatory">← All jurisdictions</a><a href="../../index.html">AIETHOS</a></div>
  <div class="cp-meta"><span>${esc(m.region)}</span><span>${esc(m.iso_code)}</span></div>
  <h1><span aria-hidden="true">${m.flag_emoji || ''}</span> ${esc(m.name)}</h1>
  <div class="cp-meta"><span class="cp-badge" style="color:var(--${f.status === 'none' ? 'advisory' : f.status})">${esc(f.status)}</span><span>${esc(f.approach)} approach</span><span>${f.binding ? 'Legally binding' : 'Not legally binding'}</span>${prov ? '<span class="cp-badge" style="color:var(--amber)">Provisional: no primary source yet</span>' : ''}</div>
  <div class="cp-cap" role="note" aria-label="Date of latest capture"><b>Captured ${esc((m.last_updated || '').slice(0, 4))}</b><span>Entry last updated ${esc(fmt(m.last_updated))}</span><span>Newest source dated ${esc(latestSrc ? fmt(latestSrc) : 'n/a')}</span><span>Framework in force since ${esc(f.year_effective || f.year_enacted || 'n/a')}</span><span>Next review due ${esc(fmt(m.next_review_due))}</span></div>
  <p style="font-size:22px;color:var(--text)">${esc(c.one_line)}</p>
  <h2>In plain English</h2><p>${esc(c.plain_language_summary)}</p>
  <h2>The framework</h2><div class="cp-card"><h3>${esc(f.primary_law)}</h3><p class="cp-note">Enforced by: ${esc(f.enforcing_body || 'n/a')} · Maximum penalty: ${esc(f.max_penalty || 'n/a')} · Scope: ${esc(f.geographic_scope || 'n/a')}</p></div><p>${esc(r.summary)}</p>`;
  if ((r.key_provisions || []).length) h += '<h3>Key provisions</h3>' + r.key_provisions.map(k => `<div class="cp-card"><h3>${esc(k.title)}</h3><p>${esc(k.description)}</p>${k.article_reference ? `<p class="cp-note">${esc(k.article_reference)}</p>` : ''}</div>`).join('');
  if (r.ethical_dimension_scores) {
    const lab = k => k.replace(/_/g, ' ').replace(/^./, s => s.toUpperCase());
    h += '<h2>Ethical dimensions</h2><p class="cp-note">Editorial scores of protections in force, 0 to 100. See the methodology on the main site.</p>' + Object.entries(r.ethical_dimension_scores).map(([k, v]) => `<div class="cp-score" title="${esc(v.rationale)}"><span>${esc(lab(k))}</span><span class="cp-bar"><i style="width:${v.score}%"></i></span><span>${v.score}</span></div><div class="cp-note" style="margin:0 0 8px">${esc(v.rationale)}</div>`).join('');
  }
  if ((r.gaps_and_weaknesses || []).length) h += '<h2>Gaps and weaknesses</h2>' + list(r.gaps_and_weaknesses);
  if ((r.cross_jurisdiction_tensions || []).length) h += '<h2>Tensions with other jurisdictions</h2>' + r.cross_jurisdiction_tensions.map(t => `<div class="cp-card"><h3><a href="../${esc(t.jurisdiction_b)}/">${esc(t.jurisdiction_b.toUpperCase())}</a> <span class="cp-note">${esc(t.severity || '')}</span></h3><p>${esc(t.tension)}</p></div>`).join('');
  if ((c.your_rights || []).length) h += '<h2>Your rights</h2>' + c.your_rights.map(x => `<div class="cp-card"><h3>${esc(x.right)}</h3><p>${esc(x.what_it_means)}</p><p class="cp-note">${esc(x.how_to_invoke || '')}</p></div>`).join('');
  if (ev && ev.sources) {
    const src = Object.fromEntries(ev.sources.map(s => [s.id, s]));
    h += '<h2>Evidence trail</h2>' + (ev.claims || []).map(cl => `<div class="cp-card"><p>${esc(cl.text)} ${(cl.source_ids || []).map(s => `<span class="ev-ref"><a href="#src-${esc(s)}">[${esc(s)}]</a></span>`).join(' ')}</p><div class="cp-note">Confidence: ${esc(cl.confidence)}</div></div>`).join('') +
      '<ol>' + ev.sources.map(s => `<li id="src-${esc(s.id)}"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>, ${esc(s.publisher)}${s.date ? ', ' + esc(s.date) : ''} <span class="cp-badge" style="color:${s.type === 'primary' ? 'var(--teal)' : 'var(--muted)'}">${esc(s.type)}</span> <span class="cp-note">accessed ${esc(s.accessed || '')}</span></li>`).join('') + '</ol>';
  }
  const docs = lib && lib.documents ? lib.documents.filter(d => d.jurisdiction === id.toUpperCase()) : [];
  if (docs.length) h += '<h2>Documents in the library</h2>' + docs.map(d => `<div class="cp-card"><h3><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)}</a></h3><p class="cp-note">${esc(d.publisher || '')} · ${esc(d.type || '')} · ${esc(d.date || '')} · checked ${esc((d.checked || '').slice(0, 10))} · ${d.verified === true || d.verified === 'True' ? 'text extracted' : 'not yet extracted'}</p></div>`).join('');
  const PL = { us: ['US', 'Indiana', 'Texas', 'Mississippi', 'Georgia', 'Wisconsin', 'Louisiana'], uk: ['UK'], ae: ['UAE'], in: ['India'], kr: [], eu: [] };
  const sites = dc && dc.sites ? dc.sites.filter(s => (PL[id] || []).some(p => s.place.includes(p))) : [];
  if (sites.length) h += '<h2>AI data centres</h2>' + sites.map(s => `<div class="cp-card"><h3>${esc(s.name)} <span class="cp-note">${esc(s.stage.replace('_', ' '))}${s.rating !== null && s.rating !== undefined ? ' · expected ethical impact ' + s.rating + (s.rating_status === 'indicative' ? ' (indicative)' : '') : ' · not rated'}</span></h3><p class="cp-note">${esc(s.place)} · ${esc(s.operator)}</p></div>`).join('') + '<p><a href="../../index.html#datacentres">See all sites and the rating method</a></p>';
  const papers = sch && sch.papers ? sch.papers.filter(p => (p.jurisdictions || []).includes(id)) : [];
  if (papers.length) h += '<h2>Scholarly context</h2><p class="cp-note">Peer-reviewed journal articles from major publishers, verified against Crossref.</p>' + papers.slice(0, 12).map(p => `<div class="cp-card"><h3><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a></h3><p class="cp-note">${esc((p.authors || []).join(', '))} · ${esc(p.journal)} · ${esc(p.publisher)} · ${p.year}</p></div>`).join('');
  h += '<div id="cn"></div>';
  root.innerHTML = h;
  document.title = `${m.name} · AI ethics and governance · AIETHOS`;
  N.mount(document.getElementById('cn'), id, m.name);
})();
