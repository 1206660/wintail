'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { createPipeline } = require('../../src/output.js');
const { makeCollapseRepeats } = require('../../src/transforms/collapseRepeats.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('emits each unique line; suppresses immediate duplicates', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeCollapseRepeats()], stdout });
  p.writeChunk('A\nA\nA\nB\n', 's');
  assert.equal(stdout.text(), 'A\n[wintail: previous line repeated 2 times]\nB\n');
});

test('singular "time" for one repeat', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeCollapseRepeats()], stdout });
  p.writeChunk('A\nA\nB\n', 's');
  assert.match(stdout.text(), /repeated 1 time\]/);
});

test('non-consecutive duplicates are not collapsed', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeCollapseRepeats()], stdout });
  p.writeChunk('A\nB\nA\n', 's');
  assert.equal(stdout.text(), 'A\nB\nA\n');
});

test('per-source state isolated', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeCollapseRepeats()], stdout });
  p.writeChunk('hello\n', 'A');
  p.writeChunk('hello\n', 'B');
  // both should be emitted (different sources, no inter-source collapse)
  assert.equal(stdout.text(), 'hello\nhello\n');
});

test('disabled passthrough', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeCollapseRepeats({ enabled: false })], stdout });
  p.writeChunk('A\nA\nA\n', 's');
  assert.equal(stdout.text(), 'A\nA\nA\n');
});
