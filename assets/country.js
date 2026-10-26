(async function () {
  const id = document.body.dataset.c;
  const N = window.AIETHOS_NOTES, esc = N.esc, root = document.getElementById('cp');
  const get = async u => { try { const r = await fetch('../../' + u); return r.ok ? r.json() : null; } catch (e) { return null; } };
  const [j, lib, dc, sch] = await Promise.all([get(`data/jurisdictions/${id}.json`), get('data/library.json'), get('data/global/datacentres.json'), get('data/scholarly.json')]);
  if (!j) { root.innerHTML = '<p class="msg err">This entry could not be loaded. Reload the page, or go back to the country list.</p><p><a href="../../index.html#/">All countries</a></p>'; return; }
  const m = j.meta, f = j.framework, r = j.research, c = j.citizen, ev = j.evidence;
  const ST = { enacted: 'var(--st-enacted)', active: 'var(--st-active)', draft: 'var(--st-draft)', voluntary: 'var(--st-voluntary)', consultation: 'var(--st-consultation)', advisory: 'var(--st-advisory)', none: 'var(--st-none)' };
  const fmt = d => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'not set';
  const srcDates = ((ev && ev.sources) || []).map(s => s.date).filter(Boolean).sort();
  const latestSrc = srcDates[srcDates.length - 1];
  const prov = ev && !(ev.sources || []).some(s => s.type === 'primary');
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';
  const sec = (t, sub, body, open) => `<details class="acc"${open ? ' open' : ''}><summary><span><span class="acc-title">${t}</span>${sub ? `<span class="acc-sub">${sub}</span>` : ''}</span></summary><div class="acc-body">${body}</div></details>`;
  const lab = k => cap(k.replace(/_/g, ' ').replace(/\band\b/, 'and'));
  let h = `<a class="back" href="../../index.html#/">← All countries</a>
  <h1 tabindex="-1"><span aria-hidden="true">${esc(m.flag_emoji || '')}</span> ${esc(m.name)}</h1>
  <p class="row-meta" style="display:flex;gap:6px 14px;margin:0"><span class="pill" style="--c:${ST[f.status] || ST.none}">${esc(cap(f.status))}</span><span>${esc(cap(f.approach))} approach</span><span>${f.binding ? 'Legally binding' : 'Not legally binding'}</span>${prov ? '<span class="badge prov">Provisional</span>' : ''}</p>
  <div class="cap" role="note" aria-label="How current this entry is"><b>Captured ${esc((m.last_updated || '').slice(0, 4))}</b><span>Entry updated ${esc(fmt(m.last_updated))}</span><span>Newest source dated ${esc(latestSrc ? fmt(latestSrc) : 'not recorded')}</span><span>Framework in force since ${esc(f.year_effective || f.year_enacted || 'n/a')}. Next review ${esc(fmt(m.next_review_due))}.</span></div>
  ${prov ? '<p class="msg">This entry is provisional. It was drafted from secondary sources and has not yet been checked against the law itself.</p>' : ''}
  <p class="lead">${esc(c.one_line)}</p>`;
  h += sec('In plain English', '', `<p>${esc(c.plain_language_summary)}</p>` + ((c.real_world_examples || []).length ? c.real_world_examples.map(x => `<div class="quote"><b>${esc(x.scenario)}.</b> ${esc(x.after)}</div>`).join('') : ''), true);
  if ((c.your_rights || []).length) h += sec('Your rights', `${c.your_rights.length} to know about`, c.your_rights.map(x => `<h3>${esc(x.right)}</h3><p>${esc(x.what_it_means)}</p><p class="note">${esc(x.how_to_invoke || '')}</p>`).join(''), true);
  h += sec('The law and who enforces it', esc(f.primary_law), `<p class="kv"><b>Enforced by:</b> ${esc(f.enforcing_body || 'n/a')}<br><b>Maximum penalty:</b> ${esc(f.max_penalty || 'n/a')}<br><b>Scope:</b> ${esc(f.geographic_scope || 'n/a')}</p><p>${esc(r.summary)}</p>` + (r.key_provisions || []).map(k => `<h3>${esc(k.title)}</h3><p>${esc(k.description)}</p>${k.article_reference ? `<p class="note">${esc(k.article_reference)}</p>` : ''}`).join(''));
  if (r.ethical_dimension_scores) h += sec('Scores on eight dimensions', 'Editorial, 0 to 100', Object.entries(r.ethical_dimension_scores).map(([k, v]) => `<div class="meter"><span class="lb">${esc(lab(k))}</span><span class="t"><i style="width:${v.score}%"></i></span><b>${v.score}</b><span class="note" style="grid-column:1/-1">${esc(v.rationale)}</span></div>`).join(''));
  if ((r.gaps_and_weaknesses || []).length) h += sec('Gaps and weaknesses', `${r.gaps_and_weaknesses.length} identified`, `<ul class="src-list">${r.gaps_and_weaknesses.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
  if ((r.cross_jurisdiction_tensions || []).length) h += sec('Tensions with other jurisdictions', '', r.cross_jurisdiction_tensions.map(t => `<h3><a href="../${esc(t.jurisdiction_b)}/">${esc(t.jurisdiction_b.toUpperCase())}</a> <span class="note">${esc(t.severity || '')}</span></h3><p>${esc(t.tension)}</p>`).join(''));
  if (ev && ev.sources) h += sec('Evidence and sources', `${ev.sources.length} sources, ${(ev.claims || []).length} claims`, (ev.claims || []).map(cl => `<p>${esc(cl.text)} <span class="refs">${(cl.source_ids || []).map(s => `<a href="#src-${esc(s)}">[${esc(s)}]</a>`).join(' ')}</span><br><span class="note">Confidence: ${esc(cl.confidence)}</span></p>`).join('') + `<ol class="src-list">${ev.sources.map(s => `<li id="src-${esc(s.id)}"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>, ${esc(s.publisher)}${s.date ? ', ' + esc(s.date) : ''} <span class="tag ${s.type === 'primary' ? 'p' : ''}">${esc(s.type)}</span> <span class="note">accessed ${esc(s.accessed || '')}</span></li>`).join('')}</ol>`);
  const docs = lib && lib.documents ? lib.documents.filter(d => d.jurisdiction === id.toUpperCase()) : [];
  if (docs.length) h += sec('Documents in the library', `${docs.length} tracked`, `<ul class="src-list">${docs.map(d => `<li><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)}</a> <span class="note">${esc(d.publisher || '')} · ${esc(d.date || '')} · ${d.verified === true || d.verified === 'True' ? 'text extracted' : 'link only'}</span></li>`).join('')}</ul>`);
  const PL = { us: ['US', 'Indiana', 'Texas', 'Mississippi', 'Georgia', 'Wisconsin', 'Louisiana'], uk: ['UK'], ae: ['UAE'], in: ['India'] };
  const sites = dc && dc.sites ? dc.sites.filter(s => (PL[id] || []).some(p => s.place.includes(p))) : [];
  if (sites.length) h += sec('AI data centres', `${sites.length} sites`, sites.map(s => `<p><b>${esc(s.name)}</b><br><span class="note">${esc(s.stage.replace('_', ' '))} · ${esc(s.place)} · ${s.rating != null ? 'expected ethical impact ' + s.rating + (s.rating_status === 'indicative' ? ' (indicative)' : '') : 'not rated'}</span></p>`).join('') + '<p><a href="../../index.html#/datacentres">All sites and how they are rated</a></p>');
  const papers = sch && sch.papers ? sch.papers.filter(p => (p.jurisdictions || []).includes(id)) : [];
  if (papers.length) h += sec('Scholarly context', `${papers.length} journal articles`, papers.slice(0, 12).map(p => `<p><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a><br><span class="note">${esc((p.authors || []).join(', '))} · ${esc(p.journal)} · ${p.year}</span></p>`).join(''));
  h += '<div id="cn"></div>';
  root.innerHTML = h;
  document.title = `${m.name} · AI ethics and governance · AIETHOS`;
  N.mount(document.getElementById('cn'), id, m.name);
})();
