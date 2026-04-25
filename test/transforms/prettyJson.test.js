'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makePrettyJson, looksLikeJson } = require('../../src/transforms/prettyJson.js');

test('pretty-prints valid JSON object', () => {
  const f = makePrettyJson();
  const out = f('{"a":1,"b":2}');
  assert.equal(out, '{\n  "a": 1,\n  "b": 2\n}');
});

test('pretty-prints valid JSON array', () => {
  const f = makePrettyJson();
  const out = f('[1,2,3]');
  assert.equal(out, '[\n  1,\n  2,\n  3\n]');
});

test('passes through non-JSON line', () => {
  const f = makePrettyJson();
  assert.equal(f('plain text'), 'plain text');
});

test('passes through invalid JSON that looks like JSON', () => {
  const f = makePrettyJson();
  assert.equal(f('{not really json}'), '{not really json}');
});

test('skips primitive JSON (numbers, strings)', () => {
  const f = makePrettyJson();
  assert.equal(f('42'), '42');
  assert.equal(f('"hello"'), '"hello"');
});

test('respects indent option', () => {
  const f = makePrettyJson({ indent: 4 });
  assert.equal(f('{"x":1}'), '{\n    "x": 1\n}');
});

test('looksLikeJson detection', () => {
  assert.equal(looksLikeJson('{}'), true);
  assert.equal(looksLikeJson('  []  '), true);
  assert.equal(looksLikeJson('{}'.padStart(70000, ' ')), false);
  assert.equal(looksLikeJson('('), false);
});
