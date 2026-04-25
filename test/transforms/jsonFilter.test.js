'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeJsonFilter, parseSpec, getPath } = require('../../src/transforms/jsonFilter.js');

test('getPath dot-notation', () => {
  assert.equal(getPath({ a: { b: { c: 42 } } }, ['a', 'b', 'c']), 42);
  assert.equal(getPath({ a: 1 }, ['a', 'b']), undefined);
});

test('parseSpec equality', () => {
  const s = parseSpec('level=error');
  assert.deepEqual(s.path, ['level']);
  assert.equal(s.match('error'), true);
  assert.equal(s.match('warn'), false);
});

test('parseSpec inequality', () => {
  const s = parseSpec('level!=info');
  assert.equal(s.match('error'), true);
  assert.equal(s.match('info'), false);
});

test('parseSpec gte/gt/lte/lt', () => {
  assert.equal(parseSpec('status>=400').match(500), true);
  assert.equal(parseSpec('status>=400').match(200), false);
  assert.equal(parseSpec('count>5').match(5), false);
  assert.equal(parseSpec('count>5').match(6), true);
});

test('parseSpec regex match', () => {
  const s = parseSpec('msg~^db');
  assert.equal(s.match('db connection lost'), true);
  assert.equal(s.match('cache miss'), false);
});

test('keep matching JSON line', () => {
  const f = makeJsonFilter({ specs: ['level=error'] });
  assert.match(f('{"level":"error","msg":"boom"}'), /boom/);
});

test('drop non-matching JSON line', () => {
  const f = makeJsonFilter({ specs: ['level=error'] });
  assert.equal(f('{"level":"info","msg":"hello"}'), null);
});

test('drop non-JSON line by default', () => {
  const f = makeJsonFilter({ specs: ['level=error'] });
  assert.equal(f('plain text not json'), null);
});

test('keep non-JSON when flag set', () => {
  const f = makeJsonFilter({ specs: ['level=error'], keepNonJson: true });
  assert.equal(f('plain text not json'), 'plain text not json');
});

test('multiple specs are AND', () => {
  const f = makeJsonFilter({ specs: ['level=error', 'service=api'] });
  assert.match(f('{"level":"error","service":"api","msg":"bad"}'), /bad/);
  assert.equal(f('{"level":"error","service":"db","msg":"x"}'), null);
});

test('nested path', () => {
  const f = makeJsonFilter({ specs: ['user.role=admin'] });
  assert.match(f('{"user":{"role":"admin","id":1},"msg":"yo"}'), /yo/);
  assert.equal(f('{"user":{"role":"guest"}}'), null);
});

test('key existence (no operator)', () => {
  const f = makeJsonFilter({ specs: ['error'] });
  assert.match(f('{"error":"oops","ts":1}'), /oops/);
  assert.equal(f('{"msg":"clean"}'), null);
});

test('empty specs is passthrough', () => {
  const f = makeJsonFilter({ specs: [] });
  assert.equal(f('{"any":"thing"}'), '{"any":"thing"}');
  assert.equal(f('plain'), 'plain');
});
