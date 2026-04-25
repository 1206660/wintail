'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeJsonExtract, isTemplate, formatValue } = require('../../src/transforms/jsonExtract.js');

test('isTemplate detects placeholders', () => {
  assert.equal(isTemplate('{x}'), true);
  assert.equal(isTemplate('hi {x} bye'), true);
  assert.equal(isTemplate('a,b,c'), false);
});

test('formatValue handles primitives and objects', () => {
  assert.equal(formatValue(42), '42');
  assert.equal(formatValue('hi'), 'hi');
  assert.equal(formatValue(null), '');
  assert.equal(formatValue(undefined), '');
  assert.equal(formatValue({ a: 1 }), '{"a":1}');
});

test('paths spec: single field', () => {
  const f = makeJsonExtract({ spec: 'msg' });
  assert.equal(f('{"msg":"hello"}'), 'hello');
});

test('paths spec: multiple fields space-joined', () => {
  const f = makeJsonExtract({ spec: 'level,msg' });
  assert.equal(f('{"level":"info","msg":"start"}'), 'info start');
});

test('paths spec: nested path', () => {
  const f = makeJsonExtract({ spec: 'user.id,msg' });
  assert.equal(f('{"user":{"id":42},"msg":"x"}'), '42 x');
});

test('template spec: format string', () => {
  const f = makeJsonExtract({ spec: '[{level}] {msg}' });
  assert.equal(f('{"level":"info","msg":"go"}'), '[info] go');
});

test('template spec: missing key becomes empty', () => {
  const f = makeJsonExtract({ spec: '{ts} {msg}' });
  assert.equal(f('{"msg":"x"}'), ' x');
});

test('drops non-JSON by default', () => {
  const f = makeJsonExtract({ spec: 'msg' });
  assert.equal(f('plain text'), null);
});

test('keeps non-JSON when flag set', () => {
  const f = makeJsonExtract({ spec: 'msg', keepNonJson: true });
  assert.equal(f('plain'), 'plain');
});

test('empty spec is passthrough', () => {
  const f = makeJsonExtract({});
  assert.equal(f('{"a":1}'), '{"a":1}');
});
