'use strict';

const fs = require('node:fs');

class UsageError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'UsageError';
  }
}

const MULTIPLIERS = { b: 512, k: 1024, K: 1024, M: 1024 ** 2, G: 1024 ** 3 };
const VALID_ENCODINGS = new Set(['utf8', 'utf-8', 'utf16le', 'utf-16le', 'latin1', 'ascii']);

function normalizeEncoding(enc) {
  const e = enc.toLowerCase().replace(/-/g, '');
  if (e === 'utf8') return 'utf8';
  if (e === 'utf16le') return 'utf16le';
  if (e === 'latin1') return 'latin1';
  if (e === 'ascii') return 'ascii';
  throw new UsageError(`unsupported encoding: ${enc}`);
}

function parseCount(s, flag) {
  if (typeof s !== 'string' || s.length === 0) {
    throw new UsageError(`invalid number for ${flag}: empty`);
  }
  let from = 'end';
  let str = s;
  if (str[0] === '+') { from = 'start'; str = str.slice(1); }
  else if (str[0] === '-') { from = 'end'; str = str.slice(1); }
  let mult = 1;
  if (/^\d+[bkKMG]$/.test(str)) {
    mult = MULTIPLIERS[str[str.length - 1]];
    str = str.slice(0, -1);
  }
  if (!/^\d+$/.test(str)) {
    throw new UsageError(`invalid number for ${flag}: ${s}`);
  }
  const n = parseInt(str, 10) * mult;
  if (!Number.isSafeInteger(n)) {
    throw new UsageError(`number out of range for ${flag}: ${s}`);
  }
  return { from, count: n };
}

function parseFloatOrThrow(s, flag) {
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) {
    throw new UsageError(`invalid number for ${flag}: ${s}`);
  }
  return n;
}

function parseIntOrThrow(s, flag) {
  if (!/^\d+$/.test(s)) {
    throw new UsageError(`invalid integer for ${flag}: ${s}`);
  }
  return parseInt(s, 10);
}

function readPatternsFile(filePath, flag) {
  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); }
  catch (e) { throw new UsageError(`${flag}: cannot read '${filePath}': ${e.message}`); }
  const out = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    out.push(trimmed);
  }
  return out;
}

function validateColor(s) {
  if (s === 'auto' || s === 'always' || s === 'never') return s;
  throw new UsageError(`invalid --color value: ${s} (expected auto|always|never)`);
}

function defaultOpts() {
  return {
    mode: 'tail',
    resumeIndex: null,
    files: [],
    lines: null,
    bytes: null,
    follow: false,
    quiet: false,
    verbose: false,
    sleepInterval: 1.0,
    pid: null,
    encoding: 'utf8',
    color: 'auto',
    highlights: [],
    noDefaultHighlight: false,
    grepPatterns: [],
    grepVPatterns: [],
    ignoreCase: false,
    lineNumber: false,
    notifyPatterns: [],
    webhookSpecs: [],
    prettyJson: false,
    since: null,
    until: null,
    ue: false,
    dirGlob: '*.log',
    addTimestamp: null,
    truncate: false,
    truncateWidth: null,
    save: null,
    saveAppend: false,
    stripAnsi: false,
    collapseRepeats: false,
    stats: false,
    statsInterval: 10,
    jsonFilters: [],
    jsonKeepNonJson: false,
    jsonExtract: null,
    grepAnd: false,
    regexExtract: null,
    regexExtractKeepNonMatch: false,
    maxLines: 0,
    prefix: null,
    mark: 0,
    web: null,
    webToken: null,
    theme: 'default',
    replay: null,
    head: 0,
    plain: false,
    squeezeBlank: false,
    watch: null,
    watchInterval: 2.0,
    tagSpecs: [],
    rateLimit: 0,
    every: 1,
    exitCodeMatchSpecs: [],
    showNonPrinting: false,
    nullData: false,
    contextBefore: 0,
    contextAfter: 0,
    tailFromNow: false,
    summary: false,
    summaryTop: 10,
    summaryNoNormalize: false,
    diffShowCommon: false,
    limitBytes: 0,
    plugins: [],
    reverse: false,
    checkpoint: null,
  };
}

function parseArgs(argv, baseOpts = null) {
  const opts = baseOpts ? { ...baseOpts } : defaultOpts();
  let i = 0;
  let endOfFlags = false;

  const consumeValue = (flag, inline) => {
    if (inline !== undefined) return inline;
    i++;
    if (i >= argv.length) throw new UsageError(`option '${flag}' requires an argument`);
    return argv[i];
  };

  while (i < argv.length) {
    const a = argv[i];

    if (endOfFlags || a === '-' || a === '' || a[0] !== '-') {
      opts.files.push(a);
      i++;
      continue;
    }
    if (a === '--') { endOfFlags = true; i++; continue; }

    if (a.startsWith('--')) {
      let name = a.slice(2);
      let inline;
      const eq = name.indexOf('=');
      if (eq !== -1) { inline = name.slice(eq + 1); name = name.slice(0, eq); }
      switch (name) {
        case 'help': opts.mode = 'help'; return opts;
        case 'version': opts.mode = 'version'; return opts;
        case 'install-alias': opts.mode = 'install-alias'; return opts;
        case 'uninstall-alias': opts.mode = 'uninstall-alias'; return opts;
        case 'history': opts.mode = 'history'; return opts;
        case 'completion': {
          opts.mode = 'completion';
          opts.completionShell = inline !== undefined ? inline : consumeValue('--completion');
          return opts;
        }
        case 'resume': {
          opts.mode = 'resume';
          if (inline !== undefined) {
            const n = parseInt(inline, 10);
            if (!Number.isFinite(n) || n < 1) throw new UsageError(`invalid --resume index: ${inline}`);
            opts.resumeIndex = n;
          }
          return opts;
        }
        case 'lines':
          opts.lines = parseCount(consumeValue('--lines', inline), '--lines');
          opts.bytes = null;
          break;
        case 'bytes':
          opts.bytes = parseCount(consumeValue('--bytes', inline), '--bytes');
          opts.lines = null;
          break;
        case 'follow': {
          const v = inline === undefined ? 'descriptor' : inline;
          if (v === 'descriptor' || v === '') opts.follow = 'descriptor';
          else if (v === 'name') opts.follow = 'name';
          else throw new UsageError(`invalid --follow value: ${inline}`);
          break;
        }
        case 'retry':
          opts.follow = 'name';
          break;
        case 'quiet':
        case 'silent':
          opts.quiet = true; opts.verbose = false; break;
        case 'verbose':
          opts.verbose = true; opts.quiet = false; break;
        case 'sleep-interval':
          opts.sleepInterval = parseFloatOrThrow(consumeValue('--sleep-interval', inline), '--sleep-interval');
          break;
        case 'pid':
          opts.pid = parseIntOrThrow(consumeValue('--pid', inline), '--pid');
          break;
        case 'encoding':
          opts.encoding = normalizeEncoding(consumeValue('--encoding', inline));
          break;
        case 'color':
          opts.color = inline === undefined ? 'auto' : validateColor(inline);
          break;
        case 'no-color':
          opts.color = 'never';
          break;
        case 'highlight':
          opts.highlights.push(consumeValue('--highlight', inline));
          break;
        case 'no-default-highlight':
          opts.noDefaultHighlight = true;
          break;
        case 'grep':
          opts.grepPatterns.push(consumeValue('--grep', inline));
          break;
        case 'grep-v':
          opts.grepVPatterns.push(consumeValue('--grep-v', inline));
          break;
        case 'ignore-case':
          opts.ignoreCase = true;
          break;
        case 'line-number':
          opts.lineNumber = true;
          break;
        case 'notify-on':
          opts.notifyPatterns.push(consumeValue('--notify-on', inline));
          break;
        case 'webhook':
          opts.webhookSpecs.push(consumeValue('--webhook', inline));
          break;
        case 'pretty-json':
          opts.prettyJson = true;
          break;
        case 'since':
          opts.since = consumeValue('--since', inline);
          break;
        case 'until':
          opts.until = consumeValue('--until', inline);
          break;
        case 'ue':
          opts.ue = true;
          break;
        case 'dir-glob':
          opts.dirGlob = consumeValue('--dir-glob', inline);
          break;
        case 'add-timestamp':
          opts.addTimestamp = inline === undefined ? 'time' : inline;
          break;
        case 'truncate':
          opts.truncate = true;
          if (inline !== undefined) {
            const n = parseInt(inline, 10);
            if (!Number.isFinite(n) || n <= 0) throw new UsageError(`invalid --truncate width: ${inline}`);
            opts.truncateWidth = n;
          }
          break;
        case 'save':
          opts.save = consumeValue('--save', inline);
          break;
        case 'save-append':
          opts.save = consumeValue('--save-append', inline);
          opts.saveAppend = true;
          break;
        case 'strip-ansi':
          opts.stripAnsi = true;
          break;
        case 'collapse-repeats':
          opts.collapseRepeats = true;
          break;
        case 'stats':
          opts.stats = true;
          if (inline !== undefined) {
            const n = Number(inline);
            if (!Number.isFinite(n) || n <= 0) throw new UsageError(`invalid --stats interval: ${inline}`);
            opts.statsInterval = n;
          }
          break;
        case 'json-filter':
          opts.jsonFilters.push(consumeValue('--json-filter', inline));
          break;
        case 'json-keep-non-json':
          opts.jsonKeepNonJson = true;
          break;
        case 'json-extract':
          opts.jsonExtract = consumeValue('--json-extract', inline);
          break;
        case 'grep-and':
          opts.grepAnd = true;
          break;
        case 'regex-extract':
          opts.regexExtract = consumeValue('--regex-extract', inline);
          break;
        case 'regex-extract-keep-non-match':
          opts.regexExtractKeepNonMatch = true;
          break;
        case 'include-from':
          opts.grepPatterns.push(...readPatternsFile(consumeValue('--include-from', inline), '--include-from'));
          break;
        case 'exclude-from':
          opts.grepVPatterns.push(...readPatternsFile(consumeValue('--exclude-from', inline), '--exclude-from'));
          break;
        case 'max-lines':
          opts.maxLines = parseIntOrThrow(consumeValue('--max-lines', inline), '--max-lines');
          break;
        case 'prefix':
          opts.prefix = consumeValue('--prefix', inline);
          break;
        case 'mark':
          opts.mark = inline === undefined ? 60 : Number(inline);
          if (!Number.isFinite(opts.mark) || opts.mark < 0) throw new UsageError(`invalid --mark interval: ${inline}`);
          break;
        case 'web':
          opts.web = consumeValue('--web', inline);
          break;
        case 'web-token':
          opts.webToken = consumeValue('--web-token', inline);
          break;
        case 'theme':
          opts.theme = consumeValue('--theme', inline);
          break;
        case 'replay': {
          const v = inline === undefined ? '1' : inline;
          const n = parseFloat(v);
          if (!Number.isFinite(n) || n <= 0) throw new UsageError(`invalid --replay rate: ${v}`);
          opts.replay = n;
          break;
        }
        case 'head': {
          const v = consumeValue('--head', inline);
          const n = parseInt(v, 10);
          if (!Number.isFinite(n) || n < 0) throw new UsageError(`invalid --head count: ${v}`);
          opts.head = n;
          break;
        }
        case 'plain':
          opts.plain = true;
          opts.color = 'never';
          opts.noDefaultHighlight = true;
          break;
        case 'squeeze-blank':
          opts.squeezeBlank = true;
          break;
        case 'watch':
          opts.watch = consumeValue('--watch', inline);
          break;
        case 'watch-interval': {
          const v = consumeValue('--watch-interval', inline);
          const n = parseFloat(v);
          if (!Number.isFinite(n) || n <= 0) throw new UsageError(`invalid --watch-interval: ${v}`);
          opts.watchInterval = n;
          break;
        }
        case 'tag':
          opts.tagSpecs.push(consumeValue('--tag', inline));
          break;
        case 'rate-limit': {
          const v = consumeValue('--rate-limit', inline);
          const n = parseInt(v, 10);
          if (!Number.isFinite(n) || n < 0) throw new UsageError(`invalid --rate-limit: ${v}`);
          opts.rateLimit = n;
          break;
        }
        case 'every': {
          const v = consumeValue('--every', inline);
          const n = parseInt(v, 10);
          if (!Number.isFinite(n) || n < 1) throw new UsageError(`invalid --every: ${v}`);
          opts.every = n;
          break;
        }
        case 'exit-code-on-match':
          opts.exitCodeMatchSpecs.push(consumeValue('--exit-code-on-match', inline));
          break;
        case 'show-nonprinting':
          opts.showNonPrinting = true;
          break;
        case 'null-data':
          opts.nullData = true;
          break;
        case 'context': {
          const v = consumeValue('--context', inline);
          const n = parseInt(v, 10);
          if (!Number.isFinite(n) || n < 0) throw new UsageError(`invalid --context: ${v}`);
          opts.contextBefore = n;
          opts.contextAfter = n;
          break;
        }
        case 'before-context': {
          const v = consumeValue('--before-context', inline);
          const n = parseInt(v, 10);
          if (!Number.isFinite(n) || n < 0) throw new UsageError(`invalid --before-context: ${v}`);
          opts.contextBefore = n;
          break;
        }
        case 'after-context': {
          const v = consumeValue('--after-context', inline);
          const n = parseInt(v, 10);
          if (!Number.isFinite(n) || n < 0) throw new UsageError(`invalid --after-context: ${v}`);
          opts.contextAfter = n;
          break;
        }
        case 'tail-from-now':
        case 'no-initial':
          opts.tailFromNow = true;
          break;
        case 'summary':
        case 'summary-on-exit':
          opts.summary = true;
          if (inline !== undefined) {
            const n = parseInt(inline, 10);
            if (Number.isFinite(n) && n > 0) opts.summaryTop = n;
            else throw new UsageError(`invalid --summary count: ${inline}`);
          }
          break;
        case 'summary-no-normalize':
          opts.summaryNoNormalize = true;
          break;
        case 'diff':
          opts.mode = 'diff';
          break;
        case 'diff-show-common':
          opts.diffShowCommon = true;
          break;
        case 'limit-bytes': {
          const v = consumeValue('--limit-bytes', inline);
          const n = parseInt(v, 10);
          if (!Number.isFinite(n) || n < 0) throw new UsageError(`invalid --limit-bytes: ${v}`);
          opts.limitBytes = n;
          break;
        }
        case 'plugin':
          opts.plugins.push(consumeValue('--plugin', inline));
          break;
        case 'reverse':
          opts.reverse = true;
          break;
        case 'checkpoint':
          opts.checkpoint = consumeValue('--checkpoint', inline);
          break;
        case 'config':
          consumeValue('--config', inline);  // pre-scanned, already loaded
          break;
        case 'no-config':
          break;  // pre-scanned
        case 'profile':
          consumeValue('--profile', inline);  // pre-scanned
          break;
        default:
          throw new UsageError(`unrecognized option '--${name}'`);
      }
      i++;
      continue;
    }

    const body = a.slice(1);
    let j = 0;
    let advanceOuter = true;
    while (j < body.length) {
      const c = body[j];
      switch (c) {
        case 'h': opts.mode = 'help'; return opts;
        case 'V': opts.mode = 'version'; return opts;
        case 'f':
          if (opts.follow !== 'name') opts.follow = 'descriptor';
          j++; break;
        case 'F': opts.follow = 'name'; j++; break;
        case 'q': opts.quiet = true; opts.verbose = false; j++; break;
        case 'v': opts.verbose = true; opts.quiet = false; j++; break;
        case 'n': {
          const tail = body.slice(j + 1);
          const val = tail !== '' ? tail : consumeValue('-n');
          opts.lines = parseCount(val, '-n');
          opts.bytes = null;
          j = body.length;
          break;
        }
        case 'c': {
          const tail = body.slice(j + 1);
          const val = tail !== '' ? tail : consumeValue('-c');
          opts.bytes = parseCount(val, '-c');
          opts.lines = null;
          j = body.length;
          break;
        }
        case 's': {
          const tail = body.slice(j + 1);
          const val = tail !== '' ? tail : consumeValue('-s');
          opts.sleepInterval = parseFloatOrThrow(val, '-s');
          j = body.length;
          break;
        }
        case 'G': {
          const tail = body.slice(j + 1);
          const val = tail !== '' ? tail : consumeValue('-G');
          opts.grepPatterns.push(val);
          j = body.length;
          break;
        }
        case 'N': opts.lineNumber = true; j++; break;
        case 'i': opts.ignoreCase = true; j++; break;
        case 'A': {
          const tail = body.slice(j + 1);
          if (tail !== '' && /^\d+$/.test(tail)) {
            // grep-style -A N (after-context)
            opts.contextAfter = parseInt(tail, 10);
            j = body.length;
            break;
          }
          // bare -A is --show-nonprinting
          opts.showNonPrinting = true;
          j++; break;
        }
        case 'z': opts.nullData = true; j++; break;
        case 'C': {
          const tail = body.slice(j + 1);
          const val = tail !== '' ? tail : consumeValue('-C');
          const n = parseInt(val, 10);
          if (!Number.isFinite(n) || n < 0) throw new UsageError(`invalid -C: ${val}`);
          opts.contextBefore = n;
          opts.contextAfter = n;
          j = body.length; break;
        }
        case 'B': {
          const tail = body.slice(j + 1);
          const val = tail !== '' ? tail : consumeValue('-B');
          const n = parseInt(val, 10);
          if (!Number.isFinite(n) || n < 0) throw new UsageError(`invalid -B: ${val}`);
          opts.contextBefore = n;
          j = body.length; break;
        }
        default:
          throw new UsageError(`unrecognized option '-${c}'`);
      }
    }
    if (advanceOuter) i++;
  }

  if (!opts.lines && !opts.bytes) {
    opts.lines = { from: 'end', count: 10 };
  }
  if (opts.files.length === 0) opts.files.push('-');

  return opts;
}

module.exports = { parseArgs, UsageError, parseCount, defaultOpts };
