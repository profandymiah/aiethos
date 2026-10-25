// Scholarly sweep: OpenAlex candidates -> publisher whitelist -> Crossref verification.
// Writes library/scholarly.json. Runs on GitHub Actions (open internet). Node 20.
const fs = require('fs');
const MAIL = 'andymiah@gmail.com';
const FROM = 2011, TO = new Date().getFullYear();
const PUBLISHERS = [
  [/elsevier|cell press|lancet/i, 'Elsevier'], [/springer|nature portfolio|nature publishing|bmc/i, 'Springer Nature'],
  [/wiley/i, 'Wiley'], [/taylor|routledge/i, 'Taylor & Francis'], [/sage/i, 'SAGE'],
  [/oxford university press/i, 'Oxford University Press'], [/cambridge university press/i, 'Cambridge University Press'],
  [/association for computing machinery|^acm/i, 'ACM'], [/institute of electrical and electronics|ieee/i, 'IEEE'],
  [/american association for the advancement of science/i, 'AAAS (Science)'], [/mit press|mit-press/i, 'MIT Press'],
  [/national academy of sciences/i, 'PNAS'], [/royal society/i, 'Royal Society'], [/plos|public library of science/i, 'PLOS'],
  [/frontiers media/i, 'Frontiers'], [/mdpi/i, 'MDPI'], [/jama|american medical association/i, 'AMA'], [/bmj/i, 'BMJ'],
];
// Large commercial publishers only; open-access mega-publishers (Frontiers, MDPI, PLOS) are excluded by default.
const EXCLUDE = new Set(['Frontiers', 'MDPI', 'PLOS']);
const BASE = '("artificial intelligence" OR "machine learning" OR algorithmic OR "autonomous systems" OR "large language model*" OR "generative AI" OR robot*)';
const ETH = '(ethic* OR "human rights" OR accountab* OR fairness OR responsib* OR governance OR regulat* OR transparen*)';
const THEMES = [
  ['principles', 'guideline* OR principles OR framework*'],
  ['governance', 'governance OR regulation OR law OR legislation OR policy'],
  ['bias', 'bias OR discrimination OR fairness'],
  ['transparency', 'explainab* OR transparen* OR interpretab*'],
  ['accountability', 'accountab* OR responsib* OR liability'],
  ['privacy', 'privacy OR "data protection" OR surveillance'],
  ['safety', 'safety OR alignment OR "existential risk" OR superintelligence'],
  ['work', 'labour OR labor OR employment OR automation OR workers'],
  ['environment', 'environmental OR carbon OR energy OR sustainability'],
  ['health', 'health* OR clinical OR medical'],
  ['military', 'military OR "autonomous weapons" OR warfare'],
  ['genai', '"generative AI" OR "large language model*" OR ChatGPT'],
  ['global-south', '"global south" OR decolonial OR colonial OR africa*'],
  ['rights', '"human rights" OR democracy'],
  ['public-sector', '"public sector" OR government OR "algorithmic decision-making" OR welfare'],
  ['adoption', 'barrier* OR adoption OR implementation OR organizational OR organisational'],
  ['operationalising', 'operationalis* OR operationaliz* OR "in practice" OR "from principles"'],
  ['auditing', 'audit* OR "impact assessment" OR assurance'],
];
const JUR = [['eu', /\b(EU|European Union|GDPR|AI Act|Europe)\b/], ['us', /\b(US|U\.S\.|United States|American|America)\b/], ['uk', /\b(UK|United Kingdom|Britain|British)\b/], ['cn', /\bChin(a|ese)\b/], ['in', /\bIndia(n)?\b/], ['jp', /\bJapan(ese)?\b/], ['kr', /\bKorea(n)?\b/], ['sg', /\bSingapore\b/], ['br', /\bBrazil(ian)?\b/], ['au', /\bAustralia(n)?\b/], ['ca', /\bCanad(a|ian)\b/], ['ch', /\bSwiss|Switzerland\b/], ['ae', /\b(UAE|Emirates|Gulf)\b/], ['ke', /\b(Kenya|Africa(n)?)\b/], ['vn', /\bVietnam(ese)?\b/]];
const DIAG = { requests: 0, failures: [] };
const AIRE = /artificial intelligence|machine learning|algorithm|\bAI\b|autonomous|robot|language model|generative|deep learning|chatbot|ChatGPT|automated decision/i;
const ETHRE = /ethic|moral|fair|bias|discriminat|accountab|responsib|transparen|explainab|governance|regulat|rights|trust|privacy|safety|risk|law|polic|principle/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function j(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': `AIETHOS/1.0 (mailto:${MAIL})` }, signal: AbortSignal.timeout(25000) });
      DIAG.requests++; if (r.ok) return await r.json(); if (DIAG.failures.length < 5) DIAG.failures.push({ status: r.status, url: url.slice(0, 400), body: (await r.text()).slice(0, 400) }); if (!j.logged) { j.logged = 1; console.log('HTTP', r.status, url.slice(0, 160), (await r.text()).slice(0, 300)); } if (r.status === 404) return null; if (r.status === 429) await sleep(3000 * (i + 1)); } catch (e) {}
    await sleep(1500 * (i + 1));
  }
  return null;
}
const pub = n => { if (!n) return null; for (const [re, name] of PUBLISHERS) if (re.test(n)) return name; return null; };
const T0 = Date.now(), BUDGET = 20 * 60 * 1000;
(async () => {
  const cand = new Map();
  for (const [tid, q] of THEMES) {
    const terms = q.replace(/[()"*]|\bOR\b|\bAND\b/g, ' ').replace(/\s+/g, ' ').trim();
    for (let y = FROM; y <= TO; y++) {
      if (Date.now() - T0 > BUDGET) break;
      const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent('artificial intelligence ethics ' + terms)}&filter=type:journal-article,from-pub-date:${y}-01-01,until-pub-date:${y}-12-31,has-abstract:true&sort=is-referenced-by-count&order=desc&rows=60&select=DOI,title,publisher,container-title,ISSN,issued,is-referenced-by-count,author,type&mailto=${MAIL}`;
      const d = await j(url); if (!d) continue;
      let kept = 0;
      for (const m of (d.message && d.message.items) || []) {
        const title = (m.title && m.title[0]) || '';
        if (!title || !AIRE.test(title) || !ETHRE.test(title)) continue;
        if (/^(editorial|erratum|correction|corrigendum|retraction)/i.test(title)) continue;
        const p = pub(m.publisher);
        if (!p || EXCLUDE.has(p)) continue;
        const cites = m['is-referenced-by-count'] || 0;
        if (cites < (y >= TO - 2 ? 8 : 25)) continue;
        const doi = m.DOI.toLowerCase();
        const c = cand.get(doi) || { doi, title, year: y, cited_by: cites, journal: (m['container-title'] && m['container-title'][0]) || '',
          issn: (m.ISSN || [])[0], publisher: p, publisher_raw: m.publisher, authors: (m.author || []).slice(0, 4).map(a => [a.given, a.family].filter(Boolean).join(' ')),
          theme_ids: [], oa: false, openalex: null, in_doaj: false };
        if (!c.theme_ids.includes(tid)) c.theme_ids.push(tid);
        cand.set(doi, c);
        if (++kept >= 6) break;
      }
      await sleep(150);
    }
    console.log(tid, cand.size);
  }
  // Crossref verification
  const out = [], rejected = [];
  let n = 0;
  for (const c of cand.values()) {
    n++;
    if (Date.now() - T0 > BUDGET + 12 * 60 * 1000) { console.log('time budget reached during verification'); break; }
    const d = await j(`https://api.crossref.org/works/${encodeURIComponent(c.doi)}?mailto=${MAIL}`);
    await sleep(120);
    const m = d && d.message;
    if (!m) { rejected.push({ doi: c.doi, reason: 'DOI not found in Crossref' }); continue; }
    if (m.type !== 'journal-article') { rejected.push({ doi: c.doi, reason: 'type ' + m.type }); continue; }
    const upd = (m['update-to'] || []).concat(m.relation && m.relation['is-retracted-by'] || []);
    if ((m['update-to'] || []).some(u => /retract|withdraw/i.test(u.type || '')) || (m.relation && m.relation['is-retracted-by'])) { rejected.push({ doi: c.doi, reason: 'retracted' }); continue; }
    const cp = pub(m.publisher) || c.publisher;
    if (EXCLUDE.has(pub(m.publisher))) { rejected.push({ doi: c.doi, reason: 'excluded publisher ' + m.publisher }); continue; }
    if (!pub(m.publisher) && !pub(c.publisher_raw)) { rejected.push({ doi: c.doi, reason: 'publisher ' + m.publisher }); continue; }
    const as = {}; (m.assertion || []).forEach(a => { if (/received|accepted|revised/i.test(a.name)) as[a.name.toLowerCase()] = a.value; });
    out.push({ ...c, title: (m.title && m.title[0]) || c.title, journal: (m['container-title'] && m['container-title'][0]) || c.journal,
      publisher: cp, publisher_crossref: m.publisher, crossref_type: m.type, crossref_cited_by: m['is-referenced-by-count'],
      issn: m.ISSN || c.issn, volume: m.volume, issue: m.issue, pages: m.page,
      peer_review: { basis: 'Journal article in a publisher-hosted journal; DOI registered with Crossref; not retracted at check date.',
        received: as.received || null, accepted: as.accepted || null, revised: as.revised || null,
        has_review_dates: !!(as.received || as.accepted), crossref_review_asserted: !!(m.review && m.review['running-number']) },
      url: 'https://doi.org/' + c.doi, verified: true, verified_at: new Date().toISOString().slice(0, 10),
      jurisdictions: JUR.filter(([k, re]) => re.test(c.title || '')).map(x => x[0]),
      is_review: /review|survey|mapping|scoping|meta-analysis/i.test(c.title || '') });
    if (n % 100 === 0) console.log('verified', n, '/', cand.size);
  }
  out.sort((a, b) => a.year - b.year || b.cited_by - a.cited_by);
  fs.mkdirSync('library', { recursive: true });
  fs.writeFileSync('library/scholarly.json', JSON.stringify({ generated: new Date().toISOString(), source: 'Crossref search ranked by citations, filtered for AI plus ethics terms in the title (Google Scholar has no API and blocks automated access; OpenAlex rate-limited), journal-article type, publisher whitelist and retraction checks',
    window: [FROM, TO], themes: THEMES.map(([id, q]) => ({ id, query: q })), publishers: [...new Set(PUBLISHERS.map(p => p[1]))].filter(p => !EXCLUDE.has(p)),
    diagnostics: DIAG, counts: { candidates: cand.size, verified: out.length, rejected: rejected.length }, rejected, papers: out }, null, 1));
  console.log('done', out.length, 'verified;', rejected.length, 'rejected');
})();
