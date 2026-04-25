'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { createPipeline } = require('../../src/output.js');
const { makeUnique } = require('../../src/transforms/unique.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('drops repeated lines (anywhere in stream, not just consecutive)', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeUnique()], stdout });
  p.writeChunk('a\nb\na\nc\nb\na\n', 's');
  assert.equal(stdout.text(), 'a\nb\nc\n');
});

test('per-source: same line in different sources both kept', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeUnique()], stdout });
  p.writeChunk('shared\n', 'A');
  p.writeChunk('shared\n', 'B');
  assert.equal(stdout.text(), 'shared\nshared\n');
});

test('disabled passthrough', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeUnique({ enabled: false })], stdout });
  p.writeChunk('x\nx\nx\n', 's');
  assert.equal(stdout.text(), 'x\nx\nx\n');
});

test('maxKeys cap: become passthrough after cap', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeUnique({ maxKeys: 2 })], stdout });
  p.writeChunk('a\nb\nc\nd\nc\n', 's');
  // After 'a','b' (2 keys), capped → 'c','d','c' all pass through
  assert.equal(stdout.text(), 'a\nb\nc\nd\nc\n');
});
