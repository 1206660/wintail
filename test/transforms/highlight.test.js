'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeHighlighter, parseUserHighlights } = require('../../src/transforms/highlight.js');

const ESC = '\x1b';
const RESET = `${ESC}[0m`;

test('built-in: ERROR is wrapped in red bold', () => {
  const h = makeHighlighter({ enabled: true });
  const out = h('something ERROR here');
  assert.equal(out, `something ${ESC}[1;31mERROR${RESET} here`);
});

test('built-in: WARNING is yellow', () => {
  const h = makeHighlighter({ enabled: true });
  assert.match(h('this is a Warning'), /\x1b\[33mWarning\x1b\[0m/);
});

test('disabled (color off) returns text unchanged', () => {
  const h = makeHighlighter({ enabled: false });
  assert.equal(h('ERROR happened'), 'ERROR happened');
});

test('--no-default-highlight: built-ins skipped', () => {
  const h = makeHighlighter({ enabled: true, includeBuiltins: false });
  assert.equal(h('ERROR happened'), 'ERROR happened');
});

test('user highlight beats built-in for same word', () => {
  const user = parseUserHighlights(['ERROR=cyan']);
  const h = makeHighlighter({ user, enabled: true });
  // user pattern (cyan = 36) should be applied, NOT built-in red
  assert.match(h('ERROR'), /\x1b\[36mERROR\x1b\[0m/);
  assert.doesNotMatch(h('ERROR'), /1;31/);
});

test('user highlight with style', () => {
  const user = parseUserHighlights(['panic=red bold']);
  const h = makeHighlighter({ user, enabled: true, includeBuiltins: false });
  assert.match(h('panic at the disco'), /\x1b\[31;1mpanic\x1b\[0m/);
});

test('multiple non-overlapping patterns in one line', () => {
  const h = makeHighlighter({ enabled: true });
  const out = h('ERROR and WARN');
  assert.match(out, /\x1b\[1;31mERROR\x1b\[0m and \x1b\[33mWARN\x1b\[0m/);
});

test('parseUserHighlights rejects bad spec', () => {
  assert.throws(() => parseUserHighlights(['justpattern']), /needs PATTERN=COLOR/);
  assert.throws(() => parseUserHighlights(['p=neon']), /unknown color/);
  assert.throws(() => parseUserHighlights(['(=red']), /invalid regex/);
});

test('empty line passes through', () => {
  const h = makeHighlighter({ enabled: true });
  assert.equal(h(''), '');
});

test('case-insensitive built-ins (lowercase error)', () => {
  const h = makeHighlighter({ enabled: true });
  assert.match(h('error: file not found'), /\x1b\[1;31merror\x1b\[0m/);
});
