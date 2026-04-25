'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeShowNonPrinting } = require('../../src/transforms/showNonPrinting.js');

test('Tab is left intact (not in CONTROL set)', () => {
  const f = makeShowNonPrinting();
  assert.equal(f('a\tb'), 'a\tb');
});

test('Carriage return shown as ^M', () => {
  const f = makeShowNonPrinting();
  assert.equal(f('hello\rworld'), 'hello^Mworld');
});

test('NUL shown as ^@', () => {
  const f = makeShowNonPrinting();
  assert.equal(f('a\x00b'), 'a^@b');
});

test('DEL (\\x7f) shown as ^?', () => {
  const f = makeShowNonPrinting();
  assert.equal(f('x\x7fy'), 'x^?y');
});

test('plain ASCII unchanged', () => {
  const f = makeShowNonPrinting();
  assert.equal(f('Hello, World!'), 'Hello, World!');
});

test('color wraps glyphs in dim yellow', () => {
  const f = makeShowNonPrinting({ color: true });
  const out = f('a\rb');
  assert.match(out, /\x1b\[2;33m\^M\x1b\[0m/);
});

test('disabled passthrough', () => {
  const f = makeShowNonPrinting({ enabled: false });
  assert.equal(f('a\rb'), 'a\rb');
});
