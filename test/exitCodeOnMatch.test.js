'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeExitCodeWatcher, compileSpec } = require('../src/exitCodeOnMatch.js');

test('compileSpec: pattern only, default code 1', () => {
  const c = compileSpec('Fatal');
  assert.equal(c.code, 1);
  assert.match('Fatal', c.regex);
});

test('compileSpec: PATTERN=CODE', () => {
  const c = compileSpec('OutOfMemory=42');
  assert.equal(c.code, 42);
  assert.match('OutOfMemory', c.regex);
});

test('compileSpec: rejects non-1-3 digit code part as just pattern', () => {
  // '=999999' isn't a valid code suffix, treat whole as pattern
  // (regex won't match anything sensible but parses fine)
  const c = compileSpec('foo=99999');
  assert.equal(c.code, 1);  // didn't strip the suffix
});

test('compileSpec: rejects invalid regex', () => {
  assert.throws(() => compileSpec('(unclosed'), /invalid regex/);
});

test('makeExitCodeWatcher: empty specs returns no-match', () => {
  const w = makeExitCodeWatcher([]);
  w.transform('any line', { source: 's' });
  assert.equal(w.getMatched(), null);
});

test('makeExitCodeWatcher: records first match', () => {
  const w = makeExitCodeWatcher(['Fatal']);
  w.transform('all clear', { source: 's' });
  w.transform('Fatal: down', { source: 's' });
  w.transform('Fatal: again', { source: 's' });
  assert.equal(w.getMatched().pattern, 'Fatal');
  assert.equal(w.getExitCode(), 1);
});

test('makeExitCodeWatcher: custom exit code', () => {
  const w = makeExitCodeWatcher(['OOM=42']);
  w.transform('OOM happened', { source: 's' });
  assert.equal(w.getExitCode(), 42);
});

test('makeExitCodeWatcher: first matching spec wins', () => {
  const w = makeExitCodeWatcher(['Fatal=10', 'Warning=5']);
  w.transform('a Warning', { source: 's' });
  assert.equal(w.getMatched().pattern, 'Warning');
  assert.equal(w.getExitCode(), 5);
});

test('makeExitCodeWatcher: line passthrough', () => {
  const w = makeExitCodeWatcher(['x']);
  assert.equal(w.transform('xyz', { source: 's' }), 'xyz');
  assert.equal(w.transform('abc', { source: 's' }), 'abc');
});
