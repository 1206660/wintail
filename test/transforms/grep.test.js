'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeGrep } = require('../../src/transforms/grep.js');

test('grep keeps matching lines', () => {
  const g = makeGrep({ patterns: ['foo'] });
  assert.equal(g('foo bar'), 'foo bar');
  assert.equal(g('hello'), null);
});

test('grep -v drops matching lines', () => {
  const g = makeGrep({ patterns: ['noise'], invert: true });
  assert.equal(g('signal line'), 'signal line');
  assert.equal(g('noise here'), null);
});

test('grep ignore-case', () => {
  const g = makeGrep({ patterns: ['ERROR'], ignoreCase: true });
  assert.equal(g('error: oh no'), 'error: oh no');
});

test('grep regex syntax', () => {
  const g = makeGrep({ patterns: ['^\\[.*\\] ERROR'] });
  assert.equal(g('[2026-01-01] ERROR boom'), '[2026-01-01] ERROR boom');
  assert.equal(g('ERROR but no brackets'), null);
});

test('multiple patterns: any match wins', () => {
  const g = makeGrep({ patterns: ['foo', 'bar'] });
  assert.equal(g('foo'), 'foo');
  assert.equal(g('bar'), 'bar');
  assert.equal(g('baz'), null);
});

test('empty patterns is passthrough', () => {
  const g = makeGrep({ patterns: [] });
  assert.equal(g('anything'), 'anything');
});

test('invalid regex throws', () => {
  assert.throws(() => makeGrep({ patterns: ['(unclosed'] }), /invalid regex/);
});

test('AND mode: all patterns must match', () => {
  const g = makeGrep({ patterns: ['ERROR', 'database'], mode: 'and' });
  assert.equal(g('ERROR: database connection lost'), 'ERROR: database connection lost');
  assert.equal(g('ERROR: timeout'), null);
  assert.equal(g('INFO: database query'), null);
});

test('AND mode + invert: drop only when all match', () => {
  const g = makeGrep({ patterns: ['a', 'b'], mode: 'and', invert: true });
  assert.equal(g('a only'), 'a only');
  assert.equal(g('a and b'), null);
});
