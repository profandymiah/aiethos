#!/usr/bin/env node
/**
 * AIETHOS discovery. Checks library/watchlist.json sources for items not seen before
 * and writes library/discovered.json (new items this run) and library/seen.json (memory).
 * Sources: federal_register, uk_bills (JSON APIs), atom/rss feeds, and page hashes.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'), LIB = path.join(ROOT, 'library');
const WATCH = process.env.WATCHLIST || path.join(LIB, 'watchlist.json');
const UA = 'Mozilla/5.0 (compatible; AIETHOS-library/1.0; +https://aiethos.andymiah.net)';
const readJSON = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const strip = h => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const AI_RE = /\b(artificial intelligence|\bAI\b|machine learning|algorithm|automated decision|frontier|data cent(er|re)|generative|chatbot|deepfake)/i;

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r;
}
function parseFeed(xml) {
  const items = [];
  const blocks = xml.match(/<(entry|item)[\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    const title = (b.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    let link = (b.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || (b.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '';
    const date = (b.match(/<(updated|pubDate|published)[^>]*>([\s\S]*?)<\/\1>/i) || [])[2] || '';
    items.push({ id: link || title, title: strip(title.replace(/<!\[CDATA\[|\]\]>/g, '')), url: link.trim(), date: date.trim() });
  }
  return items;
}

(async () => {
  const wl = readJSON(WATCH, { sources: [] });
  const seen = readJSON(path.join(LIB, 'seen.json'), {});
  const out = { run_at: new Date().toISOString(), new_items: [], page_changes: [], errors: [] };
  for (const s of wl.sources) {
    const mem = seen[s.id] || { ids: [], page_hash: null, initialised: false };
    try {
      let items = [];
      if (s.kind === 'federal_register') {
        const j = await (await get(s.url)).json();
        items = (j.results || []).map(x => ({ id: x.document_number, title: x.title, url: x.html_url, date: x.publication_date, extra: x.type }));
      } else if (s.kind === 'uk_bills') {
        const j = await (await get(s.url)).json();
        items = (j.items || []).map(x => ({ id: String(x.billId), title: x.shortTitle, url: 'https://bills.parliament.uk/bills/' + x.billId, date: x.lastUpdate, extra: x.currentHouse }));
      } else if (s.kind === 'atom' || s.kind === 'rss') {
        items = parseFeed(await (await get(s.url)).text());
      } else if (s.kind === 'page') {
        const text = strip(await (await get(s.url)).text());
        const h = sha(text);
        if (mem.page_hash && mem.page_hash !== h) out.page_changes.push({ source: s.id, label: s.label, jurisdiction: s.jurisdiction, url: s.url, signal: !!s.signal });
        mem.page_hash = h; seen[s.id] = { ...mem, initialised: true, last_checked: out.run_at }; continue;
      }
      const fresh = items.filter(i => !mem.ids.includes(i.id));
      // First run records a baseline instead of flooding the inbox.
      if (mem.initialised) {
        for (const i of fresh) if (s.kind !== 'federal_register' || AI_RE.test(i.title) || true)
          out.new_items.push({ source: s.id, label: s.label, jurisdiction: s.jurisdiction, ...i });
      }
      mem.ids = [...new Set([...items.map(i => i.id), ...mem.ids])].slice(0, 500);
      seen[s.id] = { ...mem, initialised: true, last_checked: out.run_at };
      console.log(`ok   ${s.id}: ${items.length} items, ${mem.initialised && fresh.length ? fresh.length + ' new' : 'baseline/none'}`);
    } catch (e) {
      out.errors.push({ source: s.id, error: String(e.message || e) });
      console.log(`FAIL ${s.id}: ${e.message || e}`);
      seen[s.id] = mem;
    }
  }
  fs.writeFileSync(path.join(LIB, 'seen.json'), JSON.stringify(seen, null, 2));
  fs.writeFileSync(path.join(LIB, 'discovered.json'), JSON.stringify(out, null, 2));
  console.log(`\nnew items ${out.new_items.length}, page changes ${out.page_changes.length}, errors ${out.errors.length}`);
})();
