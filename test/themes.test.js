'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { THEMES, getTheme, listThemes } = require('../src/themes.js');
const { makeHighlighter, builtinPatternsForTheme } = require('../src/transforms/highlight.js');

test('default theme has all severity codes', () => {
  const t = getTheme('default');
  assert.ok(t.error && t.warn && t.info && t.debug);
});

test('listThemes returns 7+ presets including built-ins', () => {
  const ts = listThemes();
  for (const name of ['default', 'dracula', 'solarized', 'monokai', 'nord', 'github', 'high-contrast']) {
    assert.ok(ts.includes(name), `missing ${name}`);
  }
});

test('getTheme rejects unknown name', () => {
  assert.throws(() => getTheme('borealis'), /unknown theme/);
});

test('builtinPatternsForTheme uses theme codes', () => {
  const draculaPatterns = builtinPatternsForTheme('dracula');
  const errorPattern = draculaPatterns.find(p => p.regex.source.includes('error'));
  assert.equal(errorPattern.codeKey, '1;91');
});

test('makeHighlighter respects theme', () => {
  const h = makeHighlighter({ enabled: true, theme: 'monokai' });
  // monokai info code is 95 (magenta), default is 36 (cyan)
  const out = h('this is INFO line');
  assert.match(out, /\x1b\[95mINFO\x1b\[0m/);
});

test('makeHighlighter default theme unchanged', () => {
  const h = makeHighlighter({ enabled: true });
  const out = h('an INFO line');
  assert.match(out, /\x1b\[36mINFO\x1b\[0m/);
});

test('high-contrast uses background colors', () => {
  const h = makeHighlighter({ enabled: true, theme: 'high-contrast' });
  const out = h('ERROR happened');
  assert.match(out, /\x1b\[1;97;41mERROR\x1b\[0m/);
});
