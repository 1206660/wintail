'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { expand, hasGlob } = require('../src/glob.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wintail-glob-'));
fs.writeFileSync(path.join(TMP, 'a.log'), '');
fs.writeFileSync(path.join(TMP, 'b.log'), '');
fs.writeFileSync(path.join(TMP, 'c.txt'), '');
fs.mkdirSync(path.join(TMP, 'subdir'));
fs.writeFileSync(path.join(TMP, 'subdir', 'd.log'), '');

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test('hasGlob detects wildcard chars', () => {
  assert.equal(hasGlob('a.log'), false);
  assert.equal(hasGlob('*.log'), true);
  assert.equal(hasGlob('a?.log'), true);
  assert.equal(hasGlob('[ab].log'), true);
});

test('literal arg passed through unchanged', () => {
  assert.deepEqual(expand(['a.log']), ['a.log']);
});

test('glob expands and sorts', () => {
  const out = expand([path.join(TMP, '*.log')]);
  assert.deepEqual(out, [path.join(TMP, 'a.log'), path.join(TMP, 'b.log')]);
});

test('mixed literal and glob preserved in order', () => {
  const out = expand(['literal.txt', path.join(TMP, '*.log')]);
  assert.deepEqual(out, ['literal.txt', path.join(TMP, 'a.log'), path.join(TMP, 'b.log')]);
});

test('directory entries skipped (nodir)', () => {
  const out = expand([path.join(TMP, '*')]);
  assert.ok(!out.includes(path.join(TMP, 'subdir')));
  assert.ok(out.includes(path.join(TMP, 'a.log')));
});

test('"-" passes through (stdin)', () => {
  assert.deepEqual(expand(['-']), ['-']);
});

test('empty match throws', () => {
  assert.throws(
    () => expand([path.join(TMP, '*.nope')]),
    /No match/,
  );
});
