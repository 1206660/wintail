'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { createPipeline } = require('../../src/output.js');
const { makeRateLimit } = require('../../src/transforms/rateLimit.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('passes lines under the limit', () => {
  let now = 1000;
  const stdout = captureStream();
  const p = createPipeline({
    transforms: [makeRateLimit({ perSec: 5, now: () => now })], stdout,
  });
  for (let i = 0; i < 5; i++) p.writeChunk(`l${i}\n`, 's');
  assert.equal(stdout.text().split('\n').filter(Boolean).length, 5);
});

test('drops lines exceeding the limit', () => {
  let now = 1000;
  const stdout = captureStream();
  const p = createPipeline({
    transforms: [makeRateLimit({ perSec: 3, now: () => now })], stdout,
  });
  for (let i = 0; i < 10; i++) p.writeChunk(`l${i}\n`, 's');
  // Only 3 should make it through this 1-second window
  const lines = stdout.text().split('\n').filter(Boolean);
  assert.equal(lines.length, 3);
});

test('summary line emitted when window rolls over', () => {
  let now = 1000;
  const stdout = captureStream();
  const p = createPipeline({
    transforms: [makeRateLimit({ perSec: 2, now: () => now })], stdout,
  });
  for (let i = 0; i < 5; i++) p.writeChunk(`burst${i}\n`, 's');
  now += 1100;  // window rolls
  p.writeChunk('next\n', 's');
  const out = stdout.text();
  assert.match(out, /3 lines dropped \(rate-limit 2\/s\)/);
  assert.match(out, /next/);
});

test('per-source state isolated', () => {
  let now = 1000;
  const stdout = captureStream();
  const p = createPipeline({
    transforms: [makeRateLimit({ perSec: 2, now: () => now })], stdout,
  });
  // Each source gets its own 2/s budget
  for (let i = 0; i < 3; i++) p.writeChunk(`a${i}\n`, 'A');
  for (let i = 0; i < 3; i++) p.writeChunk(`b${i}\n`, 'B');
  // 2 from A + 2 from B = 4 lines
  const lines = stdout.text().split('\n').filter(Boolean);
  assert.equal(lines.length, 4);
});

test('disabled passthrough', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeRateLimit({ perSec: 0 })], stdout });
  for (let i = 0; i < 100; i++) p.writeChunk(`l${i}\n`, 's');
  assert.equal(stdout.text().split('\n').filter(Boolean).length, 100);
});
