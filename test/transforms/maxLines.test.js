'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { createPipeline } = require('../../src/output.js');
const { makeMaxLines } = require('../../src/transforms/maxLines.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('emits up to limit then drops', async () => {
  const stdout = captureStream();
  let triggered = false;
  const t = makeMaxLines({ limit: 3, onLimitReached: () => { triggered = true; } });
  const p = createPipeline({ transforms: [t], stdout });
  p.writeChunk('a\nb\nc\nd\ne\n', 's');
  // wait one microtask for setImmediate to fire
  await new Promise((r) => setImmediate(r));
  assert.equal(stdout.text(), 'a\nb\nc\n');
  assert.equal(triggered, true);
});

test('limit 0 is passthrough (no cap)', () => {
  const stdout = captureStream();
  const t = makeMaxLines({ limit: 0 });
  const p = createPipeline({ transforms: [t], stdout });
  p.writeChunk('a\nb\nc\n', 's');
  assert.equal(stdout.text(), 'a\nb\nc\n');
});

test('onLimitReached fires exactly once', async () => {
  const stdout = captureStream();
  let calls = 0;
  const t = makeMaxLines({ limit: 2, onLimitReached: () => { calls++; } });
  const p = createPipeline({ transforms: [t], stdout });
  p.writeChunk('a\nb\nc\nd\n', 's');
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 1);
});
