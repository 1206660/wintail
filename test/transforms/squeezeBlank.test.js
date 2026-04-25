'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { createPipeline } = require('../../src/output.js');
const { makeSqueezeBlank } = require('../../src/transforms/squeezeBlank.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('collapses consecutive blanks to one', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeSqueezeBlank()], stdout });
  p.writeChunk('a\n\n\n\nb\n', 's');
  assert.equal(stdout.text(), 'a\n\nb\n');
});

test('treats whitespace-only lines as blank', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeSqueezeBlank()], stdout });
  p.writeChunk('a\n   \n\t\n  \nb\n', 's');
  assert.equal(stdout.text(), 'a\n   \nb\n');
});

test('leaves non-consecutive blanks alone', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeSqueezeBlank()], stdout });
  p.writeChunk('a\n\nb\n\nc\n', 's');
  assert.equal(stdout.text(), 'a\n\nb\n\nc\n');
});

test('per-source state isolated', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeSqueezeBlank()], stdout });
  p.writeChunk('a\n\n', 'A');
  p.writeChunk('\nb\n', 'B');
  // B's first \n is blank but distinct source — kept
  assert.equal(stdout.text(), 'a\n\n\nb\n');
});

test('disabled passthrough', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeSqueezeBlank({ enabled: false })], stdout });
  p.writeChunk('a\n\n\n\nb\n', 's');
  assert.equal(stdout.text(), 'a\n\n\n\nb\n');
});
