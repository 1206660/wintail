'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { createPipeline } = require('../../src/output.js');
const { makeLineNumberer } = require('../../src/transforms/lineNumber.js');
const { makeGrep } = require('../../src/transforms/grep.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('line numbers prefixed with tab', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeLineNumberer()], stdout });
  p.writeChunk('a\nb\nc\n', 'src');
  assert.equal(stdout.text(), '1\ta\n2\tb\n3\tc\n');
});

test('per-source counters are independent', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [makeLineNumberer()], stdout });
  p.writeChunk('x\ny\n', 'A');
  p.writeChunk('p\nq\nr\n', 'B');
  assert.equal(stdout.text(), '1\tx\n2\ty\n1\tp\n2\tq\n3\tr\n');
});

test('grep before lineNumber: dropped lines do not increment', () => {
  const stdout = captureStream();
  const p = createPipeline({
    transforms: [makeGrep({ patterns: ['keep'] }), makeLineNumberer()],
    stdout,
  });
  p.writeChunk('keep1\ndrop\nkeep2\ndrop\nkeep3\n', 'src');
  assert.equal(stdout.text(), '1\tkeep1\n2\tkeep2\n3\tkeep3\n');
});
