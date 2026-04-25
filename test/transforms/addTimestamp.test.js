'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeAddTimestamp } = require('../../src/transforms/addTimestamp.js');

test('default format is HH:MM:SS', () => {
  const fixed = new Date(2026, 3, 26, 9, 5, 7);
  const f = makeAddTimestamp({ now: () => fixed });
  assert.equal(f('hello'), '09:05:07 hello');
});

test('iso format', () => {
  const fixed = new Date(Date.UTC(2026, 3, 26, 10, 30, 45, 500));
  const f = makeAddTimestamp({ format: 'iso', now: () => fixed });
  assert.equal(f('x'), '2026-04-26T10:30:45.500Z x');
});

test('epoch format', () => {
  const fixed = new Date(2000000000 * 1000);
  const f = makeAddTimestamp({ format: 'epoch', now: () => fixed });
  assert.equal(f('x'), '2000000000 x');
});

test('epoch-ms format', () => {
  const fixed = new Date(1234567890123);
  const f = makeAddTimestamp({ format: 'epoch-ms', now: () => fixed });
  assert.equal(f('x'), '1234567890123 x');
});

test('disabled passthrough', () => {
  const f = makeAddTimestamp({ enabled: false });
  assert.equal(f('hello'), 'hello');
});

test('unknown format throws', () => {
  assert.throws(() => makeAddTimestamp({ format: 'xyz' }), /unknown/);
});

test('color wraps timestamp dim when color enabled', () => {
  const fixed = new Date(2026, 0, 1, 0, 0, 0);
  const f = makeAddTimestamp({ now: () => fixed, color: true });
  assert.equal(f('hi'), '\x1b[2m00:00:00\x1b[0m hi');
});
