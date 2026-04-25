'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { createPipeline } = require('../../src/output.js');
const { makeSinceFilter } = require('../../src/transforms/since.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('--since drops lines older than cutoff', () => {
  const stdout = captureStream();
  const cutoff = new Date(2026, 3, 26, 10, 30, 0);
  const since = `[2026.04.26-10.30.00]`;
  const t = makeSinceFilter({ since });
  const p = createPipeline({ transforms: [t], stdout });
  p.writeChunk('[2026.04.26-10.29.00] old\n', 's');
  p.writeChunk('[2026.04.26-10.30.30] kept\n', 's');
  p.writeChunk('[2026.04.26-10.31.00] also kept\n', 's');
  assert.match(stdout.text(), /kept/);
  assert.doesNotMatch(stdout.text(), /old/);
});

test('--since with relative spec', () => {
  // make a line within 10s of now and one 1h ago, --since=5m should keep recent only
  const stdout = captureStream();
  const now = Date.now();
  const recent = new Date(now);
  const oldT = new Date(now - 60 * 60 * 1000);  // 1h ago
  const fmt = (d) => `[${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}.${String(d.getMinutes()).padStart(2,'0')}.${String(d.getSeconds()).padStart(2,'0')}]`;
  const t = makeSinceFilter({ since: '5m' });
  const p = createPipeline({ transforms: [t], stdout });
  p.writeChunk(`${fmt(oldT)} old\n${fmt(recent)} recent\n`, 's');
  assert.match(stdout.text(), /recent/);
  assert.doesNotMatch(stdout.text(), /old/);
});

test('lines without timestamp inherit previous (stack trace stays attached)', () => {
  const stdout = captureStream();
  const t = makeSinceFilter({ since: '[2026.04.26-10.30.00]' });
  const p = createPipeline({ transforms: [t], stdout });
  p.writeChunk('[2026.04.26-10.29.00] old top\n', 's');
  p.writeChunk('  at frame1\n', 's');  // no timestamp; inherits old → dropped
  p.writeChunk('[2026.04.26-10.31.00] new top\n', 's');
  p.writeChunk('  at frame2\n', 's');  // inherits new → kept
  const out = stdout.text();
  assert.doesNotMatch(out, /old top/);
  assert.doesNotMatch(out, /frame1/);
  assert.match(out, /new top/);
  assert.match(out, /frame2/);
});

test('--until drops lines newer than cutoff', () => {
  const stdout = captureStream();
  const t = makeSinceFilter({ until: '[2026.04.26-10.30.00]' });
  const p = createPipeline({ transforms: [t], stdout });
  p.writeChunk('[2026.04.26-10.29.00] kept\n[2026.04.26-10.31.00] dropped\n', 's');
  assert.match(stdout.text(), /kept/);
  assert.doesNotMatch(stdout.text(), /dropped/);
});

test('--since + --until window', () => {
  const stdout = captureStream();
  const t = makeSinceFilter({
    since: '[2026.04.26-10.00.00]',
    until: '[2026.04.26-11.00.00]',
  });
  const p = createPipeline({ transforms: [t], stdout });
  p.writeChunk('[2026.04.26-09.00.00] before\n[2026.04.26-10.30.00] inside\n[2026.04.26-12.00.00] after\n', 's');
  assert.match(stdout.text(), /inside/);
  assert.doesNotMatch(stdout.text(), /before/);
  assert.doesNotMatch(stdout.text(), /after/);
});

test('lines with no parseable timestamp and no inheritance pass through', () => {
  const stdout = captureStream();
  const t = makeSinceFilter({ since: '[2026.04.26-10.30.00]' });
  const p = createPipeline({ transforms: [t], stdout });
  p.writeChunk('plain line one\nplain line two\n', 's');
  assert.match(stdout.text(), /plain line one/);
});
