#!/usr/bin/env node

/**
 * AETHON Observatory — build/extract.js
 *
 * Reads all jurisdiction JSON entries from source/regulatory/
 * Validates them against required fields
 * Produces lightweight JSON files in data/ that the website loads
 *
 * Usage:
 *   node build/extract.js              — full build
 *   node build/extract.js --dry-run    — validate only, don't write files
 *   node build/extract.js --watch      — rebuild on file changes
 *   node build/extract.js --verbose    — show full detail per entry
 *
 * Output files:
 *   data/jurisdictions.json     — lightweight cards for the regulatory monitor
 *   data/jurisdictions/         — full entries, one per jurisdiction
 *   data/ethics-scores.json     — dimension scores across all jurisdictions
 *   data/ticker.json            — items for the news ticker
 *   data/meta.json              — build metadata (timestamp, count, coverage)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const ROOT       = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'source', 'regulatory');
const DATA_DIR   = path.join(ROOT, 'data');
const ENTRY_FILE = '-entry.json';

const ARGS     = process.argv.slice(2);
const DRY_RUN  = ARGS.includes('--dry-run');
const WATCH    = ARGS.includes('--watch');
const VERBOSE  = ARGS.includes('--verbose');

const STATUS_COLOURS = {
  enacted:      '\x1b[36m', // teal
  active:       '\x1b[34m', // blue
  draft:        '\x1b[33m', // yellow
  consultation: '\x1b[35m', // purple
  voluntary:    '\x1b[35m', // purple
  advisory:     '\x1b[90m', // grey
  none:         '\x1b[90m', // grey
};
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM    = '\x1b[2m';

// ─── REQUIRED FIELDS ─────────────────────────────────────────────────────────

const REQUIRED_META = ['id','name','region','iso_code','entry_author','last_updated','confidence'];
const REQUIRED_FRAMEWORK = ['primary_law','status','approach','binding','geographic_scope'];
const REQUIRED_RESEARCH = ['summary','ethical_dimension_scores'];
const REQUIRED_CITIZEN = ['one_line','what_changed','who_is_protected','who_is_not_protected','your_rights','plain_language_summary'];

const VALID_STATUSES    = ['enacted','active','draft','consultation','voluntary','advisory','none'];
const VALID_APPROACHES  = ['comprehensive','sectoral','voluntary','rights-based','innovation-led','state-directed'];
const VALID_CONFIDENCE  = ['high','medium','low'];
const SCORE_DIMENSIONS  = ['safety_risk_management','privacy_data_protection','human_oversight','transparency','accountability','fairness_non_discrimination','environmental_sustainability','access_to_remedy'];

// ─── LOGGING ─────────────────────────────────────────────────────────────────

const log = {
  info:    (m) => console.log(`  ${m}`),
  ok:      (m) => console.log(`  ${GREEN}✓${RESET} ${m}`),
  warn:    (m) => console.log(`  ${YELLOW}⚠${RESET} ${m}`),
  error:   (m) => console.log(`  ${RED}✗${RESET} ${m}`),
  section: (m) => console.log(`\n${BOLD}${m}${RESET}`),
  dim:     (m) => console.log(`  ${DIM}${m}${RESET}`),
};

// ─── VALIDATION ──────────────────────────────────────────────────────────────

function validate(entry, filePath) {
  const errors   = [];
  const warnings = [];
  const j        = entry.jurisdiction;

  if (!j) { errors.push('Missing root "jurisdiction" key'); return { errors, warnings }; }

  // Meta
  REQUIRED_META.forEach(f => {
    if (!j.meta?.[f] && j.meta?.[f] !== false && j.meta?.[f] !== 0)
      errors.push(`meta.${f} is required`);
  });
  if (j.meta?.confidence && !VALID_CONFIDENCE.includes(j.meta.confidence))
    errors.push(`meta.confidence must be one of: ${VALID_CONFIDENCE.join(', ')}`);

  // Framework
  REQUIRED_FRAMEWORK.forEach(f => {
    if (j.framework?.[f] === undefined || j.framework?.[f] === null)
      errors.push(`framework.${f} is required`);
  });
  if (j.framework?.status && !VALID_STATUSES.includes(j.framework.status))
    errors.push(`framework.status must be one of: ${VALID_STATUSES.join(', ')}`);
  if (j.framework?.approach && !VALID_APPROACHES.includes(j.framework.approach))
    errors.push(`framework.approach must be one of: ${VALID_APPROACHES.join(', ')}`);

  // Research layer
  REQUIRED_RESEARCH.forEach(f => {
    if (!j.research_layer?.[f])
      errors.push(`research_layer.${f} is required`);
  });

  // Scores
  const scores = j.research_layer?.ethical_dimension_scores;
  if (scores) {
    SCORE_DIMENSIONS.forEach(dim => {
      if (!scores[dim]) {
        errors.push(`research_layer.ethical_dimension_scores.${dim} is missing`);
      } else {
        const s = scores[dim].score;
        if (s === null || s === undefined) warnings.push(`Score for ${dim} is null — set to 0 if no provisions exist`);
        if (typeof s === 'number' && (s < 0 || s > 100)) errors.push(`Score for ${dim} must be 0–100 (got ${s})`);
        if (!scores[dim].rationale) warnings.push(`No rationale for ${dim} score`);
      }
    });
  }

  // Citizen layer
  REQUIRED_CITIZEN.forEach(f => {
    if (!j.citizen_layer?.[f])
      errors.push(`citizen_layer.${f} is required`);
  });

  if (j.citizen_layer?.your_rights?.length === 0)
    warnings.push('citizen_layer.your_rights is empty — at least one right should be documented');

  if (!j.citizen_layer?.jargon_buster || Object.keys(j.citizen_layer.jargon_buster || {}).length === 0)
    warnings.push('citizen_layer.jargon_buster is empty — consider adding key terms');

  return { errors, warnings };
}

// ─── TRANSFORM — full entry for data/jurisdictions/{id}.json ──────────────────

function transformFull(entry) {
  const j = entry.jurisdiction;
  return {
    _generated:      new Date().toISOString(),
    _schema_version: entry._schema_version,
    meta:            j.meta,
    framework:       j.framework,
    research:        j.research_layer,
    citizen:         j.citizen_layer,
    monitor:         j.monitor,
    evidence:        j.evidence || null,
  };
}

// ─── TRANSFORM — lightweight card for data/jurisdictions.json ─────────────────

function transformCard(entry) {
  const j      = entry.jurisdiction;
  const scores = j.research_layer?.ethical_dimension_scores || {};

  // Compute weighted composite score
  const weights = {
    safety_risk_management:    0.15,
    privacy_data_protection:   0.15,
    human_oversight:           0.15,
    transparency:              0.12,
    accountability:            0.12,
    fairness_non_discrimination: 0.12,
    environmental_sustainability: 0.10,
    access_to_remedy:          0.09,
  };

  let composite = 0;
  let totalWeight = 0;
  SCORE_DIMENSIONS.forEach(dim => {
    const s = scores[dim]?.score;
    if (typeof s === 'number') {
      composite   += s * weights[dim];
      totalWeight += weights[dim];
    }
  });
  const compositeScore = totalWeight > 0 ? Math.round(composite / totalWeight) : null;

  return {
    id:           j.meta.id,
    name:         j.meta.name,
    region:       j.meta.region,
    iso_code:     j.meta.iso_code,
    flag:         j.meta.flag_emoji,
    confidence:   j.meta.confidence,
    last_updated: j.meta.last_updated,

    primary_law:    j.framework.primary_law,
    status:         j.framework.status,
    approach:       j.framework.approach,
    binding:        j.framework.binding,
    year_enacted:   j.framework.year_enacted,
    year_effective: j.framework.year_effective,
    enforcing_body: j.framework.enforcing_body,
    max_penalty:    j.framework.max_penalty,

    summary:         j.research_layer?.summary,
    composite_score: compositeScore,
    dimension_scores: SCORE_DIMENSIONS.reduce((acc, dim) => {
      acc[dim] = scores[dim]?.score ?? null;
      return acc;
    }, {}),
    gaps_count: (j.research_layer?.gaps_and_weaknesses || []).length,
    provisional: !!(j.evidence?.sources?.length) && !j.evidence.sources.some(x => x.type === 'primary'),

    one_line:       j.citizen_layer?.one_line,
    rights_count:   (j.citizen_layer?.your_rights || []).length,
    examples_count: (j.citizen_layer?.real_world_examples || []).length,

    monitor_assigned: !!j.monitor?.assigned_to,
  };
}

// ─── TRANSFORM — ethics scores for the dimension tracker ──────────────────────

function buildEthicsScores(cards) {
  const result = {};

  SCORE_DIMENSIONS.forEach(dim => {
    const vals = cards
      .map(c => c.dimension_scores[dim])
      .filter(v => typeof v === 'number');

    result[dim] = {
      global_average: vals.length
        ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        : null,
      jurisdiction_count: vals.length,
      highest: vals.length ? Math.max(...vals) : null,
      lowest:  vals.length ? Math.min(...vals) : null,
      by_jurisdiction: cards
        .filter(c => typeof c.dimension_scores[dim] === 'number')
        .map(c => ({ id: c.id, name: c.name, score: c.dimension_scores[dim] }))
        .sort((a, b) => b.score - a.score),
    };
  });

  return result;
}

// ─── TRANSFORM — ticker items ─────────────────────────────────────────────────

function buildTicker(cards) {
  const items = [];

  cards.forEach(c => {
    // Recent updates
    const updated = new Date(c.last_updated);
    const age     = (Date.now() - updated) / (1000 * 60 * 60 * 24);
    if (age < 90) {
      items.push({
        type:      'update',
        iso:       c.iso_code,
        name:      c.name,
        text:      `${c.name} entry updated — ${c.primary_law}`,
        date:      c.last_updated,
        priority:  age < 7 ? 'high' : 'normal',
      });
    }

    // Enacted frameworks
    if (c.status === 'enacted' && c.year_effective) {
      items.push({
        type: 'enforcement',
        iso:  c.iso_code,
        name: c.name,
        text: `${c.name} — ${c.primary_law} effective ${c.year_effective}`,
        date: String(c.year_effective),
        priority: 'high',
      });
    }

    // Active consultations
    if (c.status === 'consultation') {
      items.push({
        type:     'consultation',
        iso:      c.iso_code,
        name:     c.name,
        text:     `${c.name} — public consultation open on ${c.primary_law}`,
        date:     c.last_updated,
        priority: 'normal',
      });
    }
  });

  return items
    .sort((a, b) => (a.priority === 'high' ? -1 : 1))
    .slice(0, 40);  // cap at 40 items
}

// ─── TRANSFORM — build metadata ───────────────────────────────────────────────

function buildMeta(cards, errors) {
  const byRegion   = {};
  const byStatus   = {};
  const byApproach = {};

  cards.forEach(c => {
    byRegion[c.region]     = (byRegion[c.region]     || 0) + 1;
    byStatus[c.status]     = (byStatus[c.status]     || 0) + 1;
    byApproach[c.approach] = (byApproach[c.approach] || 0) + 1;
  });

  return {
    generated_at:       new Date().toISOString(),
    schema_version:     '1.0.0',
    jurisdiction_count: cards.length,
    monitored_count:    cards.filter(c => c.monitor_assigned).length,
    high_confidence:    cards.filter(c => c.confidence === 'high').length,
    by_region:          byRegion,
    by_status:          byStatus,
    by_approach:        byApproach,
    build_errors:       errors,
    average_composite:  Math.round(
      cards
        .filter(c => c.composite_score !== null)
        .reduce((sum, c) => sum + c.composite_score, 0)
        / cards.filter(c => c.composite_score !== null).length
    ) || null,
  };
}

// ─── WRITE ────────────────────────────────────────────────────────────────────

function write(filePath, data) {
  if (DRY_RUN) {
    log.dim(`[dry-run] Would write: ${path.relative(ROOT, filePath)}`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}


// ── Library: manifest + fetch state -> data/library.json ──
try {
  const lm = path.join(ROOT, 'library', 'manifest.json');
  if (fs.existsSync(lm)) {
    const man = JSON.parse(fs.readFileSync(lm, 'utf8'));
    let st = {}, disc = {};
    try { st = JSON.parse(fs.readFileSync(path.join(ROOT, 'library', 'state.json'), 'utf8')); } catch (e) {}
    try { disc = JSON.parse(fs.readFileSync(path.join(ROOT, 'library', 'discovered.json'), 'utf8')); } catch (e) {}
    write(path.join(ROOT, 'data', 'library.json'), {
      _generated: new Date().toISOString(),
      documents: man.documents.map(d => {
        const s = st[d.id] || {};
        return { id: d.id, jurisdiction: d.jurisdiction, title: d.title, publisher: d.publisher, url: d.url, type: d.type, date: d.date || null,
          checked: s.last_checked || null, changed: s.last_changed || null, verified: s.url_verified === true, sha256: s.sha256 ? s.sha256.slice(0, 12) : null,
          text_chars: s.text_chars || null, error: s.error || null, note: d.note || null };
      }),
      latest: (disc.new_items || []).slice(0, 20)
    });
  }
} catch (e) { console.error('Library data error:', e.message); process.exitCode = 1; }

// ── Global (non-jurisdiction) data: instruments, trajectories, datacentres ──
try {
  const gdir = path.join(ROOT, 'source', 'global');
  if (fs.existsSync(gdir)) {
    for (const f of fs.readdirSync(gdir).filter(x => x.endsWith('.json'))) {
      const data = JSON.parse(fs.readFileSync(path.join(gdir, f), 'utf8'));

      if (f === 'datacentres.json' && Array.isArray(data.sites) && data.methodology) {
        const crits = data.methodology.criteria;
        for (const site of data.sites) {
          let sum = 0, w = 0, n = 0;
          for (const c of crits) { const s = site.criteria && site.criteria[c.id] && site.criteria[c.id].score; if (typeof s === 'number') { sum += s * c.weight; w += c.weight; n++; } }
          site.rating = w ? Math.round(sum / w) : null;
          site.evidence_count = n;
          site.rating_status = n >= 3 ? 'rated' : n >= 1 ? 'indicative' : 'unrated';
          const b = data.methodology.bands.find(x => n >= 3 && site.rating >= x.min);
          site.rating_label = b ? b.label : null;
        }
      }
      write(path.join(ROOT, 'data', 'global', f), data);
    }
  }
} catch (e) { console.error('Global data error:', e.message); process.exitCode = 1; }

// ─── MAIN BUILD ───────────────────────────────────────────────────────────────

function build() {
  const startTime   = Date.now();
  const buildErrors = [];
  const cards       = [];
  const fullEntries = [];

  console.log(`\n${BOLD}AETHON Observatory — Build${RESET}`);
  console.log(`${DIM}${new Date().toLocaleString()}${DRY_RUN ? '  [dry-run]' : ''}${RESET}`);
  log.section('1. Scanning source/regulatory/');

  // Find all *-entry.json files recursively
  if (!fs.existsSync(SOURCE_DIR)) {
    log.error(`source/regulatory/ not found at ${SOURCE_DIR}`);
    log.info('Run setup-observatory.sh first to create the folder structure.');
    process.exit(1);
  }

  const entryFiles = [];
  const walk = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(dirent => {
      const full = path.join(dir, dirent.name);
      if (dirent.isDirectory()) walk(full);
      else if (dirent.name.endsWith(ENTRY_FILE)) entryFiles.push(full);
    });
  };
  walk(SOURCE_DIR);

  if (entryFiles.length === 0) {
    log.warn('No *-entry.json files found in source/regulatory/');
    log.info('Add jurisdiction entries using the template in aethon-jurisdiction-template.json');
    log.info('See the documentation for how to name and place files.');
    process.exit(0);
  }

  log.info(`Found ${entryFiles.length} entr${entryFiles.length === 1 ? 'y' : 'ies'}`);
  if (VERBOSE) entryFiles.forEach(f => log.dim(path.relative(ROOT, f)));

  // ── Parse and validate ────────────────────────────────────────────────────

  log.section('2. Validating entries');

  entryFiles.forEach(filePath => {
    const rel = path.relative(ROOT, filePath);
    let raw;

    try {
      raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      log.error(`${rel} — JSON parse error: ${e.message}`);
      buildErrors.push({ file: rel, type: 'parse_error', message: e.message });
      return;
    }

    const { errors, warnings } = validate(raw, filePath);
    const id = raw?.jurisdiction?.meta?.id || path.basename(path.dirname(filePath));
    const sc = STATUS_COLOURS[raw?.jurisdiction?.framework?.status] || '';

    if (errors.length > 0) {
      log.error(`${id.toUpperCase().padEnd(6)} ${rel}`);
      errors.forEach(e => log.error(`         ${e}`));
      buildErrors.push({ file: rel, type: 'validation', errors });
      return;  // skip this entry — don't include invalid data
    }

    if (warnings.length > 0) {
      log.warn(`${id.toUpperCase().padEnd(6)} ${rel}`);
      if (VERBOSE) warnings.forEach(w => log.warn(`         ${w}`));
      else log.dim(`         ${warnings.length} warning${warnings.length > 1 ? 's' : ''} (run --verbose to see)`);
    } else {
      const name   = raw.jurisdiction.meta.name.padEnd(30);
      const status = `${sc}${raw.jurisdiction.framework.status}${RESET}`.padEnd(20);
      log.ok(`${id.toUpperCase().padEnd(6)} ${name} ${status} confidence:${raw.jurisdiction.meta.confidence}`);
    }

    cards.push(transformCard(raw));
    fullEntries.push({ id, full: transformFull(raw) });
  });

  // ── Write output files ────────────────────────────────────────────────────

  log.section('3. Writing data/');

  if (cards.length === 0) {
    log.warn('No valid entries to write — fix validation errors above and re-run.');
    process.exit(buildErrors.length > 0 ? 1 : 0);
  }

  const sortedCards = [...cards].sort((a, b) => a.name.localeCompare(b.name));
  const ethicsScores = buildEthicsScores(sortedCards);
  const ticker       = buildTicker(sortedCards);
  const meta         = buildMeta(sortedCards, buildErrors);

  // data/jurisdictions.json — all cards
  write(path.join(DATA_DIR, 'jurisdictions.json'), {
    _generated: new Date().toISOString(),
    count: sortedCards.length,
    jurisdictions: sortedCards,
  });
  log.ok(`jurisdictions.json  (${sortedCards.length} jurisdictions, ~${
    Math.round(JSON.stringify(sortedCards).length / 1024)
  }KB)`);

  // data/jurisdictions/{id}.json — full entries
  fullEntries.forEach(({ id, full }) => {
    write(path.join(DATA_DIR, 'jurisdictions', `${id}.json`), full);
    if (VERBOSE) log.dim(`jurisdictions/${id}.json`);
  });
  log.ok(`jurisdictions/      (${fullEntries.length} full entr${fullEntries.length === 1 ? 'y' : 'ies'})`);

  // data/ethics-scores.json
  write(path.join(DATA_DIR, 'ethics-scores.json'), {
    _generated: new Date().toISOString(),
    dimensions: ethicsScores,
  });
  log.ok(`ethics-scores.json  (8 dimensions across ${cards.length} jurisdictions)`);

  // data/ticker.json
  write(path.join(DATA_DIR, 'ticker.json'), {
    _generated: new Date().toISOString(),
    count: ticker.length,
    items: ticker,
  });
  log.ok(`ticker.json         (${ticker.length} items)`);

  // data/meta.json
  write(path.join(DATA_DIR, 'meta.json'), meta);
  log.ok(`meta.json`);

  // ── Summary ───────────────────────────────────────────────────────────────

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  log.section('Summary');

  console.log(`  Jurisdictions processed : ${GREEN}${cards.length}${RESET} valid  ${
    buildErrors.length > 0 ? `${RED}${buildErrors.length} failed${RESET}` : ''
  }`);

  const byStatus = {};
  cards.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });
  Object.entries(byStatus).sort((a,b) => b[1]-a[1]).forEach(([s,n]) => {
    const col = STATUS_COLOURS[s] || '';
    console.log(`  ${col}${s.padEnd(14)}${RESET}: ${n}`);
  });

  if (meta.average_composite) {
    console.log(`  Global avg ethics score : ${BOLD}${meta.average_composite}${RESET}/100`);
  }

  if (buildErrors.length > 0) {
    console.log(`\n  ${RED}${buildErrors.length} file${buildErrors.length > 1 ? 's' : ''} failed validation — fix errors above and re-run.${RESET}`);
  }

  console.log(`\n  ${DIM}Completed in ${duration}s${DRY_RUN ? ' (dry-run — no files written)' : ''}${RESET}\n`);

  if (buildErrors.length > 0) process.exit(1);
}

// ─── WATCH MODE ───────────────────────────────────────────────────────────────

if (WATCH) {
  console.log(`${BOLD}AETHON — watch mode${RESET} (Ctrl+C to stop)\n`);
  build();
  fs.watch(SOURCE_DIR, { recursive: true }, (event, filename) => {
    if (filename?.endsWith('.json')) {
      console.log(`\n${DIM}Change detected: ${filename}${RESET}`);
      setTimeout(build, 200);  // small debounce
    }
  });
} else {
  build();
}
try{const sp='library/scholarly.json';if(fs.existsSync(path.join(__dirname,'..',sp))){const d=JSON.parse(fs.readFileSync(path.join(__dirname,'..',sp),'utf8'));delete d.rejected;const ex=new Set(JSON.parse(fs.readFileSync(path.join(__dirname,'..','source/global/scholarly-exclude.json'),'utf8')).dois);d.papers=d.papers.filter(p=>!ex.has(p.doi));d.counts.shown=d.papers.length;fs.writeFileSync(path.join(__dirname,'..','data/scholarly.json'),JSON.stringify(d));}}catch(e){console.error('scholarly copy failed',e.message)}
require('./pages.js');
