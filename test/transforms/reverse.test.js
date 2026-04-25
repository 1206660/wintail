'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { reverseBuffer } = require('../../src/transforms/reverse.js');

test('reverses lines preserving trailing newline', () => {
  const buf = Buffer.from('one\ntwo\nthree\n');
  assert.equal(reverseBuffer(buf).toString('utf8'), 'three\ntwo\none\n');
});

test('reverses lines preserving missing trailing newline', () => {
  const buf = Buffer.from('a\nb\nc');
  assert.equal(reverseBuffer(buf).toString('utf8'), 'c\nb\na');
});

test('single line passthrough', () => {
  assert.equal(reverseBuffer(Buffer.from('only\n')).toString('utf8'), 'only\n');
});

test('empty buffer', () => {
  assert.equal(reverseBuffer(Buffer.from('')).toString('utf8'), '');
});

test('two lines swap', () => {
  assert.equal(reverseBuffer(Buffer.from('a\nb\n')).toString('utf8'), 'b\na\n');
});
