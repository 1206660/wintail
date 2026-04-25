'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { createPipeline } = require('../../src/output.js');
const { makeLimitBytes } = require('../../src/transforms/limitBytes.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('passes lines under the byte budget', () => {
  const stdout = captureStream();
  const t = makeLimitBytes({ limit: 100, onLimitReached: () => {} });
  const p = createPipeline({ transforms: [t], stdout });
  p.writeChunk('short\nshort\nshort\n', 's');
  assert.equal(stdout.text(), 'short\nshort\nshort\n');
});

test('drops lines after budget exceeded', async () => {
  const stdout = captureStream();
  let triggered = false;
  const t = makeLimitBytes({ limit: 12, onLimitReached: () => { triggered = true; } });  // ~2 lines
  const p = createPipeline({ transforms: [t], stdout });
  p.writeChunk('aaaaa\nbbbbb\nccccc\nddddd\n', 's');
  await new Promise(r => setImmediate(r));
  // Each line is 5 chars + 1 EOL = 6 bytes. Budget 12 = 2 lines.
  assert.equal(stdout.text(), 'aaaaa\nbbbbb\n');
  assert.equal(triggered, true);
});

test('limit 0 is passthrough', () => {
  const stdout = captureStream();
  const t = makeLimitBytes({ limit: 0 });
  const p = createPipeline({ transforms: [t], stdout });
  p.writeChunk('any\nthing\n', 's');
  assert.equal(stdout.text(), 'any\nthing\n');
});

test('multibyte chars counted correctly', () => {
  const stdout = captureStream();
  const t = makeLimitBytes({ limit: 8, onLimitReached: () => {} });
  const p = createPipeline({ transforms: [t], stdout });
  p.writeChunk('日\n', 's');  // 3 bytes utf8 + 1 EOL = 4
  p.writeChunk('日\n', 's');  // 4 more = 8
  p.writeChunk('日\n', 's');  // would exceed
  assert.equal(stdout.text(), '日\n日\n');
});
