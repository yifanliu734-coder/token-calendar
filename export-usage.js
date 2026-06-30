#!/usr/bin/env node
'use strict';

// token-calendar-export
// Scans Claude Code's local session logs (~/.claude/projects/**/*.jsonl) and
// aggregates daily token usage + an estimated cost, printing JSON that you can
// paste straight into Token Calendar's import box.
//
//   node export-usage.js                 # print JSON to stdout
//   node export-usage.js --out usage.json
//   node export-usage.js --days 90       # only the last 90 days
//   node export-usage.js --copy          # copy JSON to the clipboard (macOS)
//
// Cost is ESTIMATED from public Claude list prices below — it is a rough guide,
// not a bill. Your real spend is in the Anthropic Console. Adjust PRICING if the
// rates change or you use other models.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

// USD per 1M tokens — public list prices, estimate only.
const PRICING = {
  opus:   { in: 15,   out: 75, cacheW: 18.75, cacheR: 1.5  },
  sonnet: { in: 3,    out: 15, cacheW: 3.75,  cacheR: 0.30 },
  haiku:  { in: 0.80, out: 4,  cacheW: 1.0,   cacheR: 0.08 },
};

function tierOf(model) {
  const m = (model || '').toLowerCase();
  if (m.includes('opus'))   return 'opus';
  if (m.includes('haiku'))  return 'haiku';
  if (m.includes('sonnet')) return 'sonnet';
  return null;
}

function* walkJsonl(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkJsonl(p);
    else if (e.isFile() && p.endsWith('.jsonl')) yield p;
  }
}

function localDate(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return null;
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

// Scan local Claude Code logs and aggregate per-day usage.
// Returns { daily, files, rows } or { error } when logs are missing.
function aggregate(opts = {}) {
  const root = opts.root || path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(root)) return { error: `No Claude Code logs found at ${root}` };

  let cutoff = null;
  if (opts.days && opts.days > 0) {
    const c = new Date();
    c.setDate(c.getDate() - opts.days);
    cutoff = c.toLocaleDateString('en-CA');
  }

  const daily = {};
  let files = 0, rows = 0;

  for (const file of walkJsonl(root)) {
    files++;
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }
    for (const line of content.split('\n')) {
      if (!line) continue;
      let e;
      try { e = JSON.parse(line); } catch { continue; }
      if (e.type !== 'assistant') continue;
      const msg = e.message || {};
      const u = msg.usage;
      if (!u) continue;
      const date = localDate(e.timestamp);
      if (!date) continue;
      if (cutoff && date < cutoff) continue;

      const inp = u.input_tokens || 0;
      const out = u.output_tokens || 0;
      const cW  = u.cache_creation_input_tokens || 0;
      const cR  = u.cache_read_input_tokens || 0;
      const tokens = inp + out + cW + cR;
      if (tokens === 0) continue;

      let cost = 0;
      const tier = tierOf(msg.model);
      if (tier) {
        const p = PRICING[tier];
        cost = (inp / 1e6) * p.in + (out / 1e6) * p.out
             + (cW / 1e6) * p.cacheW + (cR / 1e6) * p.cacheR;
      }

      const model = (msg.model || '').replace(/^claude-/, '');
      if (!daily[date]) daily[date] = { cost: 0, tokens: 0, models: [] };
      daily[date].cost = Math.round((daily[date].cost + cost) * 1e4) / 1e4;
      daily[date].tokens += tokens;
      if (model && !daily[date].models.includes(model)) daily[date].models.push(model);
      rows++;
    }
  }

  return { daily, files, rows };
}

function fmtTokens(n) {
  return n >= 1e9 ? (n/1e9).toFixed(2)+'B'
       : n >= 1e6 ? (n/1e6).toFixed(1)+'M'
       : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : String(n);
}

function summarize(daily) {
  const dates = Object.keys(daily).sort();
  const tokens = dates.reduce((s, d) => s + daily[d].tokens, 0);
  const cost = dates.reduce((s, d) => s + daily[d].cost, 0);
  return { dates, tokens, cost };
}

function parseArgs(argv) {
  const a = { out: null, days: null, copy: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--out')  a.out = argv[++i];
    else if (k === '--days') a.days = parseInt(argv[++i], 10);
    else if (k === '--copy') a.copy = true;
    else if (k === '--help' || k === '-h') a.help = true;
  }
  return a;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    process.stderr.write('Usage: token-calendar-export [--out file] [--days N] [--copy]\n');
    return;
  }

  const { daily, files, rows, error } = aggregate({ days: args.days });
  if (error) { process.stderr.write(error + '\n'); process.exit(1); }

  const { dates, tokens, cost } = summarize(daily);
  if (!dates.length) {
    process.stderr.write('No usage rows found. Nothing to export.\n');
    process.exit(1);
  }

  const json = JSON.stringify(daily, null, 2);
  if (args.out) {
    fs.writeFileSync(args.out, json);
  } else if (args.copy) {
    try { execFileSync('pbcopy', { input: json }); }
    catch { process.stdout.write(json + '\n'); }
  } else {
    process.stdout.write(json + '\n');
  }

  process.stderr.write(
    `\nScanned ${files} files, ${rows} usage rows.\n` +
    `${dates.length} active days  (${dates[0]} → ${dates[dates.length-1]})\n` +
    `~${fmtTokens(tokens)} tokens  ·  ~$${cost.toFixed(2)} estimated\n` +
    (args.out ? `Written to ${args.out}\n` :
     args.copy ? `Copied to clipboard — paste it into Token Calendar's import box.\n` :
     `\nPaste the JSON above into Token Calendar's import box (cost is an estimate; see Anthropic Console for your real bill).\n`)
  );
}

module.exports = { aggregate, summarize, fmtTokens, PRICING };

if (require.main === module) main();
