'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { createPipeline } = require('../../src/output.js');
const { makePrefix, expandTemplate } = require('../../src/transforms/prefix.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('literal prefix', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makePrefix({ template: 'PREFIX: ' })], stdout });
  p.writeChunk('hello\n', 's');
  assert.equal(stdout.text(), 'PREFIX: hello\n');
});

test('{source} interpolation per source', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makePrefix({ template: '[{source}] ' })], stdout });
  p.writeChunk('one\n', 'app.log');
  p.writeChunk('two\n', 'db.log');
  assert.equal(stdout.text(), '[app.log] one\n[db.log] two\n');
});

test('{time} interpolation', () => {
  const fixed = new Date(2026, 0, 1, 9, 5, 7);
  const stdout = captureStream();
  const p = createPipeline({
    transforms: [makePrefix({ template: '{time} ', now: () => fixed })],
    stdout,
  });
  p.writeChunk('hi\n', 's');
  assert.equal(stdout.text(), '09:05:07 hi\n');
});

test('combined template', () => {
  const fixed = new Date(2026, 0, 1, 12, 0, 0);
  const stdout = captureStream();
  const p = createPipeline({
    transforms: [makePrefix({ template: '{time} [{source}] ', now: () => fixed })],
    stdout,
  });
  p.writeChunk('msg\n', 'web.log');
  assert.equal(stdout.text(), '12:00:00 [web.log] msg\n');
});

test('disabled / empty template passthrough', () => {
  const stdout = captureStream();
  const p1 = createPipeline({ transforms: [makePrefix({ enabled: false, template: 'X' })], stdout });
  p1.writeChunk('a\n', 's');
  assert.equal(stdout.text(), 'a\n');
});

test('expandTemplate utility', () => {
  const ctx = { source: 'foo' };
  const now = new Date(2026, 0, 1, 1, 2, 3);
  assert.equal(expandTemplate('{source}>{time}', ctx, now), 'foo>01:02:03');
});
