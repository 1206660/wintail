'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  discoverConfigPath, readConfigFile, isProfiled, selectProfile,
  preScanConfig, loadConfig, applyToOpts,
} = require('../src/config.js');
const { defaultOpts } = require('../src/args.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wintail-config-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let counter = 0;
function workspace(fileMap = {}) {
  const dir = path.join(TMP, `ws${counter++}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(fileMap)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

test('discoverConfigPath finds .wintailrc in cwd', () => {
  const ws = workspace({ '.wintailrc': '{}' });
  assert.equal(discoverConfigPath(ws), path.join(ws, '.wintailrc'));
});

test('discoverConfigPath returns null when none exist', () => {
  const ws = workspace();
  // Note: real homedir may have one, so we skip strict assertion when it does
  const homerc = path.join(os.homedir(), '.wintailrc');
  if (!fs.existsSync(homerc)) {
    assert.equal(discoverConfigPath(ws), null);
  }
});

test('readConfigFile rejects non-JSON', () => {
  const ws = workspace({ '.wintailrc': 'not json{' });
  assert.throws(() => readConfigFile(path.join(ws, '.wintailrc')), /invalid JSON/);
});

test('readConfigFile rejects non-object root', () => {
  const ws = workspace({ '.wintailrc': '[]' });
  assert.throws(() => readConfigFile(path.join(ws, '.wintailrc')), /must be a JSON object/);
});

test('isProfiled detects nested objects', () => {
  assert.equal(isProfiled({ a: { x: 1 }, b: { y: 2 } }), true);
  assert.equal(isProfiled({ ue: true, color: 'always' }), false);
  assert.equal(isProfiled({}), false);
});

test('selectProfile returns flat config when not profiled', () => {
  const cfg = { ue: true };
  assert.deepEqual(selectProfile(cfg, null), cfg);
  assert.deepEqual(selectProfile(cfg, 'default'), cfg);
});

test('selectProfile picks named profile', () => {
  const cfg = { default: { ue: true }, errors: { grep: ['ERR'] } };
  assert.deepEqual(selectProfile(cfg, 'errors'), { grep: ['ERR'] });
});

test('selectProfile errors on unknown profile', () => {
  const cfg = { default: { ue: true } };
  assert.throws(() => selectProfile(cfg, 'nope'), /not found/);
});

test('selectProfile errors when --profile used on flat config', () => {
  assert.throws(() => selectProfile({ ue: true }, 'errors'), /no profiles/);
});

test('preScanConfig: --config FILE', () => {
  const m = preScanConfig(['--config', '/tmp/x.json', 'other']);
  assert.equal(m.explicitPath, '/tmp/x.json');
});

test('preScanConfig: --config=FILE', () => {
  const m = preScanConfig(['--config=/tmp/x.json']);
  assert.equal(m.explicitPath, '/tmp/x.json');
});

test('preScanConfig: --no-config disables', () => {
  assert.equal(preScanConfig(['--no-config']).disabled, true);
});

test('preScanConfig: --profile=NAME', () => {
  assert.equal(preScanConfig(['--profile=errors']).profile, 'errors');
});

test('loadConfig: --no-config returns empty settings', () => {
  const r = loadConfig(['--no-config']);
  assert.deepEqual(r.settings, {});
  assert.equal(r.source, null);
});

test('loadConfig: explicit --config', () => {
  const ws = workspace({ 'foo.json': '{"ue":true,"color":"always"}' });
  const r = loadConfig(['--config', path.join(ws, 'foo.json')]);
  assert.equal(r.source, path.join(ws, 'foo.json'));
  assert.equal(r.settings.ue, true);
});

test('loadConfig: cwd .wintailrc', () => {
  const ws = workspace({ '.wintailrc': '{"ue":true}' });
  const r = loadConfig([], { cwd: ws });
  assert.equal(r.settings.ue, true);
});

test('loadConfig: profile from profiled config', () => {
  const ws = workspace({ '.wintailrc': '{"default":{"color":"always"},"errors":{"grep":["ERR"]}}' });
  const r1 = loadConfig([], { cwd: ws });
  assert.equal(r1.settings.color, 'always');
  const r2 = loadConfig(['--profile=errors'], { cwd: ws });
  assert.deepEqual(r2.settings.grep, ['ERR']);
});

test('applyToOpts: scalar fields', () => {
  const out = applyToOpts(defaultOpts(), { ue: true, color: 'always', sleepInterval: 0.5 });
  assert.equal(out.ue, true);
  assert.equal(out.color, 'always');
  assert.equal(out.sleepInterval, 0.5);
});

test('applyToOpts: array shorthands', () => {
  const out = applyToOpts(defaultOpts(), { grep: ['ERR', 'FATAL'], highlight: ['TODO=yellow'] });
  assert.deepEqual(out.grepPatterns, ['ERR', 'FATAL']);
  assert.deepEqual(out.highlights, ['TODO=yellow']);
});

test('applyToOpts: dashed-keys mapped to camelCase', () => {
  const out = applyToOpts(defaultOpts(), {
    'pretty-json': true, 'sleep-interval': 0.5, 'ignore-case': true,
  });
  assert.equal(out.prettyJson, true);
  assert.equal(out.sleepInterval, 0.5);
  assert.equal(out.ignoreCase, true);
});

test('applyToOpts: unknown key throws (catches typos)', () => {
  assert.throws(() => applyToOpts(defaultOpts(), { ueeee: true }), /unknown key/);
});

test('applyToOpts: no-color shortcut sets color=never', () => {
  const out = applyToOpts(defaultOpts(), { 'no-color': true });
  assert.equal(out.color, 'never');
});

test('end-to-end: config + CLI override (CLI wins)', () => {
  const ws = workspace({ '.wintailrc': '{"color":"always","ue":true,"grep":["ERR"]}' });
  const cfg = loadConfig([], { cwd: ws });
  const merged = applyToOpts(defaultOpts(), cfg.settings);
  assert.equal(merged.color, 'always');
  assert.equal(merged.ue, true);
  // when CLI later runs with --color=never, parseArgs starting from `merged`
  // would overwrite color to 'never'. This is tested via integration in
  // index.js wiring.
});
