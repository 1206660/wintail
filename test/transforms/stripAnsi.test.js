'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeStripAnsi } = require('../../src/transforms/stripAnsi.js');

test('strips ANSI color codes', () => {
  const f = makeStripAnsi();
  assert.equal(f('\x1b[31mERROR\x1b[0m: oh no'), 'ERROR: oh no');
});

test('strips bold + color', () => {
  const f = makeStripAnsi();
  assert.equal(f('\x1b[1;31mFatal\x1b[0m'), 'Fatal');
});

test('plain line untouched', () => {
  const f = makeStripAnsi();
  assert.equal(f('plain text'), 'plain text');
});

test('disabled passthrough', () => {
  const f = makeStripAnsi({ enabled: false });
  assert.equal(f('\x1b[31mred\x1b[0m'), '\x1b[31mred\x1b[0m');
});
