'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { createPipeline } = require('../../src/output.js');
const { makeGrepWithContext } = require('../../src/transforms/grepContext.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('before-context: 2 prior lines emitted with match', () => {
  const stdout = captureStream();
  const p = createPipeline({
    transforms: [makeGrepWithContext({ patterns: ['BOOM'], before: 2 })],
    stdout,
  });
  for (const line of ['a', 'b', 'c', 'd', 'BOOM', 'e', 'f']) p.writeChunk(line + '\n', 's');
  const lines = stdout.text().trim().split('\n');
  assert.deepEqual(lines, ['c', 'd', 'BOOM']);
});

test('after-context: 2 following lines emitted', () => {
  const stdout = captureStream();
  const p = createPipeline({
    transforms: [makeGrepWithContext({ patterns: ['BOOM'], after: 2 })],
    stdout,
  });
  for (const line of ['a', 'BOOM', 'b', 'c', 'd', 'e']) p.writeChunk(line + '\n', 's');
  const lines = stdout.text().trim().split('\n');
  assert.deepEqual(lines, ['BOOM', 'b', 'c']);
});

test('symmetric: -C 1 around BOOM', () => {
  const stdout = captureStream();
  const p = createPipeline({
    transforms: [makeGrepWithContext({ patterns: ['BOOM'], before: 1, after: 1 })],
    stdout,
  });
  for (const line of ['a', 'b', 'BOOM', 'c', 'd']) p.writeChunk(line + '\n', 's');
  const lines = stdout.text().trim().split('\n');
  assert.deepEqual(lines, ['b', 'BOOM', 'c']);
});

test('separator inserted between disjoint match groups', () => {
  const stdout = captureStream();
  const p = createPipeline({
    transforms: [makeGrepWithContext({ patterns: ['M'], before: 1, after: 1 })],
    stdout,
  });
  for (const line of ['a', 'b', 'M1', 'c', 'd', 'e', 'f', 'g', 'M2', 'h']) p.writeChunk(line + '\n', 's');
  const out = stdout.text().trim().split('\n');
  // First group: b, M1, c. Separator. Then ring (just 'g' — most recent before M2), M2, h.
  assert.deepEqual(out, ['b', 'M1', 'c', '--', 'g', 'M2', 'h']);
});

test('overlapping after of one match and match itself coalesce (no separator)', () => {
  const stdout = captureStream();
  const p = createPipeline({
    transforms: [makeGrepWithContext({ patterns: ['M'], before: 0, after: 2 })],
    stdout,
  });
  for (const line of ['M1', 'a', 'M2', 'b', 'c']) p.writeChunk(line + '\n', 's');
  const out = stdout.text().trim().split('\n');
  // M1, then a (after of M1), then M2 happens during M1's after-window so no sep,
  // then b, c (after of M2)
  assert.deepEqual(out, ['M1', 'a', 'M2', 'b', 'c']);
});

test('zero context behaves like plain grep', () => {
  const stdout = captureStream();
  const p = createPipeline({
    transforms: [makeGrepWithContext({ patterns: ['M'] })],
    stdout,
  });
  for (const line of ['a', 'M1', 'b', 'M2', 'c']) p.writeChunk(line + '\n', 's');
  assert.deepEqual(stdout.text().trim().split('\n'), ['M1', 'M2']);
});

test('disabled returns passthrough', () => {
  const stdout = captureStream();
  const p = createPipeline({
    transforms: [makeGrepWithContext({ patterns: ['x'], enabled: false })],
    stdout,
  });
  for (const line of ['a', 'b']) p.writeChunk(line + '\n', 's');
  assert.equal(stdout.text(), 'a\nb\n');
});
