#!/usr/bin/env node
/**
 * AIETHOS library fetcher.
 * Downloads every document in library/manifest.json, stores raw files (<= 20 MB),
 * extracts text to library/text/<id>.txt, and records hash and change history
 * in library/state.json. Writes library/changes.json with documents that changed
 * or failed on this run. Needs Node 18+ and (for PDFs) pdftotext (poppler-utils).
 *
 *   node build/fetch-library.js            # all documents
 *   node build/fetch-library.js --only eu-ai-act
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const LIB = path.join(ROOT, 'library');
const MANIFEST = process.env.MANIFEST || path.join(LIB, 'manifest.json');
const MAX_RAW = 20 * 1024 * 1024;
const UA = 'Mozilla/5.0 (compatible; AIETHOS-library/1.0; +https://aiethos.andymiah.net)';
const { spawnSync } = require('child_process');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

const readJSON = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ').replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
}
function pdfToText(file) {
  try { return execFileSync('pdftotext', ['-layout', file, '-'], { maxBuffer: 200 * 1024 * 1024 }).toString('utf8'); }
  catch (e) { return ''; }
}

async function fetchDoc(doc) {
  const res = await fetch(doc.url, { headers: { 'User-Agent': UA, 'Accept': '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(90000) });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, ok: res.ok, type: res.headers.get('content-type') || '', buf, finalUrl: res.url };
}


function browserFallback(doc) {
  const out = '/tmp/render-' + doc.id;
  const r = spawnSync('node', [path.join(__dirname, 'render.js'), doc.url, out], { encoding: 'utf8', timeout: 150000 });
  try {
    const j = JSON.parse((r.stdout || '').trim().split('\n').pop());
    if (!j.ok) return null;
    const buf = fs.readFileSync(out);
    return j.kind === 'pdf' ? { status: 200, ok: true, type: 'application/pdf', buf, finalUrl: doc.url, via: 'browser' }
                            : { status: 200, ok: true, type: 'text/html', buf: Buffer.from('<main>' + buf.toString('utf8').replace(/</g, '&lt;') + '</main>'), finalUrl: doc.url, via: 'browser', plain: buf.toString('utf8') };
  } catch (e) { return null; }
}

(async () => {
  const manifest = readJSON(MANIFEST, { documents: [] });
  const state = readJSON(path.join(LIB, 'state.json'), {});
  fs.mkdirSync(path.join(LIB, 'raw'), { recursive: true });
  fs.mkdirSync(path.join(LIB, 'text'), { recursive: true });
  const changes = { run_at: new Date().toISOString(), changed: [], new: [], failed: [] };
  const now = changes.run_at;

  for (const doc of manifest.documents) {
    if (only && doc.id !== only) continue;
    const prev = state[doc.id] || {};
    try {
      let r = null, firstErr = null;
      if (!doc.render) { try { r = await fetchDoc(doc); if (!r.ok) { firstErr = 'HTTP ' + r.status; r = null; } } catch (e) { firstErr = String(e.message || e); } }
      if (!r || (r.buf.length < 400 && !(r.buf.slice(0, 5).toString() === '%PDF-'))) { const b = browserFallback(doc); if (b) r = b; }
      if (!r) throw new Error(firstErr || 'empty response');
      const isPdf = /pdf/i.test(r.type) || r.buf.slice(0, 5).toString() === '%PDF-';
      let text, rawName = null;
      if (isPdf) {
        const tmp = path.join(LIB, 'raw', doc.id + '.pdf');
        if (r.buf.length <= MAX_RAW) { fs.writeFileSync(tmp, r.buf); rawName = doc.id + '.pdf'; }
        else fs.writeFileSync('/tmp/' + doc.id + '.pdf', r.buf);
        text = pdfToText(r.buf.length <= MAX_RAW ? tmp : '/tmp/' + doc.id + '.pdf');
      } else {
        text = r.plain !== undefined ? r.plain : htmlToText(r.buf.toString('utf8'));
      }
      // Hash the extracted text so cosmetic HTML changes do not trigger alerts; PDFs also hash bytes.
      const normText = text.replace(/\s+/g, ' ').trim();
      const hash = sha(isPdf && !normText ? r.buf : Buffer.from(normText));
      fs.writeFileSync(path.join(LIB, 'text', doc.id + '.txt'), text);
      const entry = { url: doc.url, final_url: r.finalUrl, http: r.status, content_type: r.type, bytes: r.buf.length, text_chars: text.length,
        sha256: hash, raw_file: rawName, fetched_via: r.via || 'http', url_verified: true, last_checked: now,
        first_seen: prev.first_seen || now, last_changed: prev.last_changed || now, prev_sha256: prev.prev_sha256 || null, error: null };
      if (!prev.sha256) changes.new.push({ id: doc.id, title: doc.title, url: doc.url });
      else if (prev.sha256 !== hash) {
        entry.prev_sha256 = prev.sha256; entry.last_changed = now;
        // keep a short diff-able snapshot of the previous text
        changes.changed.push({ id: doc.id, title: doc.title, url: doc.url, jurisdiction: doc.jurisdiction, priority: doc.priority || 'medium',
          chars_before: prev.text_chars, chars_after: text.length });
      }
      state[doc.id] = entry;
      console.log(`ok   ${doc.id} (${r.buf.length} bytes)${!prev.sha256 ? ' NEW' : prev.sha256 !== hash ? ' CHANGED' : ''}`);
    } catch (e) {
      state[doc.id] = { ...prev, url: doc.url, url_verified: false, last_checked: now, error: String(e.message || e) };
      changes.failed.push({ id: doc.id, title: doc.title, url: doc.url, error: String(e.message || e) });
      console.log(`FAIL ${doc.id}: ${e.message || e}`);
    }
  }
  fs.writeFileSync(path.join(LIB, 'state.json'), JSON.stringify(state, null, 2));
  fs.writeFileSync(path.join(LIB, 'changes.json'), JSON.stringify(changes, null, 2));

  // Human-readable index of the context library
  const lines = ['# AIETHOS context library', '', 'Extracted text of tracked documents. Search with `grep -ril "term" library/text`.', '',
    '| ID | Jurisdiction | Title | Checked | Changed | Chars |', '|---|---|---|---|---|---|'];
  for (const d of manifest.documents) {
    const s = state[d.id] || {};
    lines.push(`| [${d.id}](text/${d.id}.txt) | ${d.jurisdiction} | ${d.title.replace(/\|/g, '/')} | ${(s.last_checked || '').slice(0, 10)} | ${(s.last_changed || '').slice(0, 10)} | ${s.text_chars ?? (s.error ? 'ERROR' : '')} |`);
  }
  fs.writeFileSync(path.join(LIB, 'INDEX.md'), lines.join('\n') + '\n');
  console.log(`\nnew ${changes.new.length}, changed ${changes.changed.length}, failed ${changes.failed.length}`);
})();
