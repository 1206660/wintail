'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { createPipeline } = require('../../src/output.js');
const { createStatsCollector } = require('../../src/transforms/stats.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('counts total, errors, warns', () => {
  let t = 1000;
  const s = createStatsCollector({ now: () => t });
  const stdout = captureStream();
  const p = createPipeline({ transforms: [s.transform], stdout });
  p.writeChunk('plain line\nERROR something\nWarning fishy\nfatal crash\nplain again\n', 'app');
  const snap = s.snapshot();
  assert.equal(snap.total, 5);
  assert.equal(snap.errors, 2);
  assert.equal(snap.warns, 1);
});

test('per-source counts', () => {
  let t = 1000;
  const s = createStatsCollector({ now: () => t });
  const stdout = captureStream();
  const p = createPipeline({ transforms: [s.transform], stdout });
  p.writeChunk('a\nb\n', 'A');
  p.writeChunk('c\n', 'B');
  const snap = s.snapshot();
  assert.equal(snap.perSource.get('A'), 2);
  assert.equal(snap.perSource.get('B'), 1);
});

test('rate computation', () => {
  let t = 1000;
  const s = createStatsCollector({ now: () => t });
  const stdout = captureStream();
  const p = createPipeline({ transforms: [s.transform], stdout });
  for (let i = 0; i < 10; i++) p.writeChunk(`line${i}\n`, 's');
  t = 6000; // 5 seconds elapsed
  const snap = s.snapshot();
  assert.equal(snap.total, 10);
  assert.ok(snap.rateAvg > 1.5 && snap.rateAvg < 2.5);
});

test('report writes to stderr', () => {
  let t = 1000;
  const stderr = captureStream();
  const s = createStatsCollector({ now: () => t, stderr });
  const stdout = captureStream();
  const p = createPipeline({ transforms: [s.transform], stdout });
  p.writeChunk('ERROR boom\nplain\n', 'app');
  s.report();
  assert.match(stderr.text(), /lines=2/);
  assert.match(stderr.text(), /err=1/);
  assert.match(stderr.text(), /app=2/);
});

test('formatLine includes top sources', () => {
  let t = 1000;
  const s = createStatsCollector({ now: () => t });
  const stdout = captureStream();
  const p = createPipeline({ transforms: [s.transform], stdout });
  p.writeChunk('x\n', 'a');
  p.writeChunk('x\nx\n', 'b');
  p.writeChunk('x\nx\nx\n', 'c');
  p.writeChunk('x\nx\nx\nx\n', 'd');
  const out = s.formatLine(s.snapshot());
  assert.match(out, /d=4/);
  assert.match(out, /c=3/);
  assert.match(out, /b=2/);
  assert.doesNotMatch(out, /a=1/);  // only top 3
});
