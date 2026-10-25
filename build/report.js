#!/usr/bin/env node
/** Builds library/report.md from changes.json + discovered.json. Exit code 0; prints nothing if no news. */
const fs = require('fs'), path = require('path');
const LIB = path.resolve(__dirname, '..', 'library');
const rj = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(LIB, f), 'utf8')); } catch { return d; } };
const c = rj('changes.json', { changed: [], new: [], failed: [] }), d = rj('discovered.json', { new_items: [], page_changes: [], errors: [] });
const L = [];
if (c.changed.length) { L.push('## Tracked documents that changed', ''); c.changed.forEach(x => L.push(`- **${x.id}** (${x.jurisdiction}, ${x.priority}): [${x.title}](${x.url}), ${x.chars_before} to ${x.chars_after} characters`)); L.push(''); }
if (d.new_items.length) { L.push('## New items found', ''); d.new_items.forEach(x => L.push(`- ${x.jurisdiction}: [${x.title}](${x.url}) (${x.label}${x.date ? ', ' + x.date : ''})`)); L.push(''); }
if (d.page_changes.length) { L.push('## Watched pages that changed', ''); d.page_changes.forEach(x => L.push(`- ${x.jurisdiction}: [${x.label}](${x.url})${x.signal ? ' (secondary signal)' : ''}`)); L.push(''); }
if (c.failed.length) { L.push('## Documents that could not be fetched', ''); c.failed.forEach(x => L.push(`- ${x.id}: ${x.error} ([link](${x.url}))`)); L.push(''); }
const news = c.changed.length + d.new_items.length + d.page_changes.length;
fs.writeFileSync(path.join(LIB, 'report.md'), L.join('\n'));
fs.writeFileSync(path.join(LIB, 'has-news.txt'), news ? 'yes' : 'no');
console.log(news ? `${news} news items` : 'no news');
