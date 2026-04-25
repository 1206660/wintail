'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeTruncate, visibleLength, truncateVisible } = require('../../src/transforms/truncate.js');

test('visibleLength ignores ANSI codes', () => {
  assert.equal(visibleLength('hello'), 5);
  assert.equal(visibleLength('\x1b[31mhello\x1b[0m'), 5);
  assert.equal(visibleLength('\x1b[1;31mERROR\x1b[0m: oh no'), 12);
});

test('short line passes through', () => {
  const f = makeTruncate({ width: 80 });
  assert.equal(f('hello'), 'hello');
});

test('long line truncated with ellipsis', () => {
  const f = makeTruncate({ width: 10, ellipsis: '…' });
  assert.equal(f('abcdefghijklmnop'), 'abcdefghi…');
});

test('explicit ellipsis ASCII', () => {
  const f = makeTruncate({ width: 10, ellipsis: '...' });
  assert.equal(f('abcdefghijklmnop'), 'abcdefg...');
});

test('preserves ANSI codes in unaffected portion', () => {
  const f = makeTruncate({ width: 12, ellipsis: '…' });
  const out = f('\x1b[31mERROR\x1b[0m: long detail spans many chars');
  assert.match(out, /^\x1b\[31mERROR\x1b\[0m/);
  assert.ok(out.endsWith('…'));
});

test('truncated line ends with reset if it had color', () => {
  const out = truncateVisible('\x1b[31m' + 'x'.repeat(50), 10);
  assert.match(out, /\x1b\[0m…$/);
});

test('disabled passthrough', () => {
  const f = makeTruncate({ enabled: false, width: 5 });
  assert.equal(f('long-line-here'), 'long-line-here');
});

test('falls back to stdout.columns when no width', () => {
  const fakeStdout = { columns: 20 };
  const f = makeTruncate({ stdout: fakeStdout });
  assert.equal(f('x'.repeat(30)).length, 20);
});

test('default 80 when no stdout columns', () => {
  const f = makeTruncate({ stdout: {} });
  assert.equal(visibleLength(f('x'.repeat(200))), 80);
});
