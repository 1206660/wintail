'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const DEFAULT_FILENAMES = ['.wintailrc', '.wintailrc.json', 'wintail.config.json'];

function discoverConfigPath(cwd = process.cwd()) {
  for (const name of DEFAULT_FILENAMES) {
    const p = path.join(cwd, name);
    try { fs.accessSync(p, fs.constants.R_OK); return p; } catch {}
  }
  for (const name of DEFAULT_FILENAMES) {
    const p = path.join(os.homedir(), name);
    try { fs.accessSync(p, fs.constants.R_OK); return p; } catch {}
  }
  return null;
}

function readConfigFile(filePath) {
  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); }
  catch (e) { throw new Error(`config: cannot read '${filePath}': ${e.message}`); }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { throw new Error(`config: invalid JSON in '${filePath}': ${e.message}`); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`config: '${filePath}' must be a JSON object`);
  }
  return parsed;
}

// Profiled format = every top-level value is an object (and there's at least one).
function isProfiled(obj) {
  const values = Object.values(obj);
  if (values.length === 0) return false;
  return values.every(v => v !== null && typeof v === 'object' && !Array.isArray(v));
}

function selectProfile(config, profileName) {
  if (!isProfiled(config)) {
    if (profileName && profileName !== 'default') {
      throw new Error(`--profile=${profileName} requested but config has no profiles (flat object)`);
    }
    return config;
  }
  const name = profileName || 'default';
  if (!(name in config)) {
    const known = Object.keys(config).join(', ');
    throw new Error(`profile '${name}' not found in config (known: ${known})`);
  }
  return config[name];
}

// Pre-scan argv for --config / --no-config / --profile so we can apply config
// before the main parseArgs runs.
function preScanConfig(argv) {
  const out = { explicitPath: null, disabled: false, profile: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-config') out.disabled = true;
    else if (a === '--config' && i + 1 < argv.length) out.explicitPath = argv[++i];
    else if (a.startsWith('--config=')) out.explicitPath = a.slice('--config='.length);
    else if (a === '--profile' && i + 1 < argv.length) out.profile = argv[++i];
    else if (a.startsWith('--profile=')) out.profile = a.slice('--profile='.length);
  }
  return out;
}

function loadConfig(argv, { cwd = process.cwd() } = {}) {
  const meta = preScanConfig(argv);
  if (meta.disabled) return { settings: {}, source: null, profile: null };
  let filePath = meta.explicitPath;
  if (!filePath) filePath = discoverConfigPath(cwd);
  if (!filePath) {
    if (meta.profile) throw new Error(`--profile=${meta.profile} but no config file found`);
    return { settings: {}, source: null, profile: null };
  }
  const raw = readConfigFile(filePath);
  const settings = selectProfile(raw, meta.profile);
  return { settings, source: filePath, profile: meta.profile };
}

// Apply config settings to the defaults object. Recognized keys map 1:1 to opts.
// Lists (highlights, grepPatterns, etc.) are concatenated, not replaced — CLI
// args still get pushed on top by the parser.
const SCALAR_KEYS = new Set([
  'follow', 'quiet', 'verbose', 'sleepInterval', 'pid', 'encoding',
  'color', 'noDefaultHighlight', 'ignoreCase', 'lineNumber',
  'prettyJson', 'since', 'until', 'ue', 'dirGlob', 'addTimestamp',
  'truncate', 'truncateWidth', 'save', 'saveAppend', 'stripAnsi',
  'collapseRepeats', 'stats', 'statsInterval', 'jsonKeepNonJson',
  'jsonExtract', 'grepAnd', 'regexExtract', 'regexExtractKeepNonMatch',
  'maxLines', 'prefix', 'mark', 'web', 'webToken',
]);
const ARRAY_KEYS = new Set([
  'highlights', 'grepPatterns', 'grepVPatterns', 'notifyPatterns', 'jsonFilters',
]);
const SHORTHAND = {
  // user-friendly aliases in the JSON file
  grep: 'grepPatterns',
  'grep-v': 'grepVPatterns',
  highlight: 'highlights',
  'notify-on': 'notifyPatterns',
  'json-filter': 'jsonFilters',
  'no-color': null,  // handled below
  'sleep-interval': 'sleepInterval',
  'no-default-highlight': 'noDefaultHighlight',
  'ignore-case': 'ignoreCase',
  'line-number': 'lineNumber',
  'pretty-json': 'prettyJson',
  'dir-glob': 'dirGlob',
  'add-timestamp': 'addTimestamp',
  'strip-ansi': 'stripAnsi',
  'collapse-repeats': 'collapseRepeats',
  'stats-interval': 'statsInterval',
  'json-keep-non-json': 'jsonKeepNonJson',
  'json-extract': 'jsonExtract',
  'grep-and': 'grepAnd',
  'regex-extract': 'regexExtract',
  'regex-extract-keep-non-match': 'regexExtractKeepNonMatch',
  'max-lines': 'maxLines',
  'web-token': 'webToken',
};

function applyToOpts(defaultOpts, settings) {
  const opts = { ...defaultOpts };
  if (!settings || typeof settings !== 'object') return opts;
  for (const [rawKey, value] of Object.entries(settings)) {
    let key = rawKey;
    if (rawKey === 'no-color') {
      opts.color = 'never';
      continue;
    }
    if (rawKey in SHORTHAND) {
      key = SHORTHAND[rawKey];
      if (key === null) continue;
    }
    if (ARRAY_KEYS.has(key)) {
      const arr = Array.isArray(value) ? value : [value];
      opts[key] = [...(opts[key] || []), ...arr.map(String)];
    } else if (SCALAR_KEYS.has(key)) {
      opts[key] = value;
    } else {
      // Unknown key — silently ignore? Or throw? Throw — surfaces typos early.
      throw new Error(`config: unknown key '${rawKey}'`);
    }
  }
  return opts;
}

module.exports = {
  discoverConfigPath, readConfigFile, isProfiled, selectProfile,
  preScanConfig, loadConfig, applyToOpts,
  DEFAULT_FILENAMES,
};
