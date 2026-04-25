'use strict';

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

function validateColor(s) {
  if (s === 'auto' || s === 'always' || s === 'never') return s;
  throw new UsageError(`invalid --color value: ${s} (expected auto|always|never)`);
}

function defaultOpts() {
  return {
    mode: 'tail',
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
    prettyJson: false,
    since: null,
    until: null,
  };
}

function parseArgs(argv) {
  const opts = defaultOpts();
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
        case 'pretty-json':
          opts.prettyJson = true;
          break;
        case 'since':
          opts.since = consumeValue('--since', inline);
          break;
        case 'until':
          opts.until = consumeValue('--until', inline);
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
