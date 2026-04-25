'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { createPipeline } = require('../../src/output.js');
const { makeSample } = require('../../src/transforms/sample.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('every=1 is passthrough', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeSample({ every: 1 })], stdout });
  for (let i = 0; i < 5; i++) p.writeChunk(`l${i}\n`, 's');
  assert.equal(stdout.text().split('\n').filter(Boolean).length, 5);
});

test('every=3 keeps every 3rd line', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeSample({ every: 3 })], stdout });
  for (let i = 1; i <= 10; i++) p.writeChunk(`l${i}\n`, 's');
  // Lines 3, 6, 9 (n%3 === 0)
  assert.deepEqual(stdout.text().trim().split('\n'), ['l3', 'l6', 'l9']);
});

test('per-source counters independent', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeSample({ every: 2 })], stdout });
  // Each source gets its own counter, so 2nd line of each is emitted
  for (let i = 1; i <= 4; i++) p.writeChunk(`a${i}\n`, 'A');
  for (let i = 1; i <= 4; i++) p.writeChunk(`b${i}\n`, 'B');
  const lines = stdout.text().trim().split('\n').sort();
  assert.deepEqual(lines, ['a2', 'a4', 'b2', 'b4']);
});

test('disabled passthrough', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeSample({ enabled: false, every: 5 })], stdout });
  for (let i = 0; i < 3; i++) p.writeChunk(`l${i}\n`, 's');
  assert.equal(stdout.text().split('\n').filter(Boolean).length, 3);
});
