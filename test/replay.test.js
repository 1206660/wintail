'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { replayFile, readLinesSync } = require('../src/replay.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wintail-replay-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let counter = 0;
function tmpFile(content) {
  const p = path.join(TMP, `f${counter++}.log`);
  fs.writeFileSync(p, content);
  return p;
}

test('readLinesSync preserves trailing newlines', () => {
  const p = tmpFile('a\nb\nc\n');
  assert.deepEqual(readLinesSync(p), ['a\n', 'b\n', 'c\n']);
});

test('readLinesSync handles missing trailing newline', () => {
  const p = tmpFile('a\nb\nc');
  assert.deepEqual(readLinesSync(p), ['a\n', 'b\n', 'c']);
});

test('replayFile: emits all lines respecting timestamp gaps', async () => {
  const p = tmpFile(
    '[2026.04.26-10.30.45:000][  0]LogTemp: first\n' +
    '[2026.04.26-10.30.45:200][  0]LogTemp: second\n' +
    '[2026.04.26-10.30.45:500][  0]LogTemp: third\n'
  );
  const written = [];
  const sleepCalls = [];
  await replayFile(p, {
    rate: 1,
    write: (s) => written.push(s),
    sleep: (ms) => { sleepCalls.push(ms); return Promise.resolve(); },
  });
  assert.equal(written.length, 3);
  assert.match(written[0], /first/);
  // Two gaps: 200ms then 300ms
  assert.equal(sleepCalls.length, 2);
  assert.equal(sleepCalls[0], 200);
  assert.equal(sleepCalls[1], 300);
});

test('replayFile: rate=2 halves the gap', async () => {
  const p = tmpFile(
    '[2026.04.26-10.30.45:000][  0]LogTemp: a\n' +
    '[2026.04.26-10.30.45:400][  0]LogTemp: b\n'
  );
  const sleepCalls = [];
  await replayFile(p, { rate: 2, write: () => {}, sleep: (ms) => { sleepCalls.push(ms); return Promise.resolve(); } });
  assert.equal(sleepCalls[0], 200);
});

test('replayFile: caps very long gaps at maxDelay', async () => {
  const p = tmpFile(
    '[2026.04.26-10.30.45:000][  0]LogTemp: a\n' +
    '[2026.04.26-11.00.00:000][  0]LogTemp: b\n'  // ~30 minutes later
  );
  const sleepCalls = [];
  await replayFile(p, {
    write: () => {},
    sleep: (ms) => { sleepCalls.push(ms); return Promise.resolve(); },
  });
  assert.equal(sleepCalls[0], 5000);  // capped at MAX_DELAY_MS
});

test('replayFile: uses fallback gap for lines without timestamps', async () => {
  const p = tmpFile('plain a\nplain b\nplain c\n');
  const sleepCalls = [];
  await replayFile(p, {
    write: () => {},
    sleep: (ms) => { sleepCalls.push(ms); return Promise.resolve(); },
    fallbackGap: 50,
  });
  assert.equal(sleepCalls.length, 3);  // 1 pre-stream + 2 between
  assert.ok(sleepCalls.every(s => s === 50));
});

test('replayFile: rejects rate <= 0', async () => {
  const p = tmpFile('a\n');
  await assert.rejects(() => replayFile(p, { rate: 0 }), /rate must be > 0/);
});
