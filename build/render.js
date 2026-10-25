#!/usr/bin/env node
/**
 * Fallback fetcher using a real browser (Playwright) for pages that block plain HTTP
 * clients (403/406) or need JavaScript. Usage: node build/render.js <url> <out-file> [--pdf]
 * For documents served as files it downloads via the browser's request context.
 * Prints a JSON line: {ok, status, kind, bytes, file}
 */
const fs = require('fs');
const { chromium } = require('playwright');
const [url, out] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', locale: 'en-GB' });
  try {
    const r = await ctx.request.get(url, { timeout: 60000, headers: { 'Accept-Language': 'en-GB,en;q=0.9' } });
    const ct = r.headers()['content-type'] || '';
    if (r.ok() && /pdf/i.test(ct)) {
      const body = await r.body(); fs.writeFileSync(out, body);
      console.log(JSON.stringify({ ok: true, status: r.status(), kind: 'pdf', bytes: body.length, file: out })); return;
    }
    const page = await ctx.newPage();
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    const text = await page.evaluate(() => (document.querySelector('main') || document.body).innerText);
    fs.writeFileSync(out, text);
    console.log(JSON.stringify({ ok: !!resp && resp.status() < 400 && text.length > 200, status: resp ? resp.status() : 0, kind: 'text', bytes: text.length, file: out }));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, status: 0, error: String(e.message || e) }));
  } finally { await b.close(); }
})();
