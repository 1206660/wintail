'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Writable } = require('node:stream');
const {
  loadCheckpoint, saveCheckpoint, applyToStates, snapshotStates,
} = require('../src/checkpoint.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wintail-checkpoint-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let counter = 0;
function tmpFile() { return path.join(TMP, `cp${counter++}.json`); }

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('loadCheckpoint: missing file returns {}', () => {
  assert.deepEqual(loadCheckpoint('/nope/missing.json'), {});
});

test('loadCheckpoint: invalid JSON returns {}', () => {
  const p = tmpFile();
  fs.writeFileSync(p, 'not json{');
  assert.deepEqual(loadCheckpoint(p), {});
});

test('loadCheckpoint: array-shape returns {}', () => {
  const p = tmpFile();
  fs.writeFileSync(p, '[1,2,3]');
  assert.deepEqual(loadCheckpoint(p), {});
});

test('saveCheckpoint then loadCheckpoint roundtrip', () => {
  const p = tmpFile();
  const data = { '/a': 100, '/b': 200 };
  saveCheckpoint(p, data);
  assert.deepEqual(loadCheckpoint(p), data);
});

test('saveCheckpoint creates parent directory', () => {
  const p = path.join(TMP, 'nested', 'deep', 'cp.json');
  saveCheckpoint(p, { x: 42 });
  assert.deepEqual(loadCheckpoint(p), { x: 42 });
});

test('snapshotStates: collects offsets keyed by absolute path', () => {
  const states = [
    { path: 'app.log', offset: 100, size: 200 },
    { path: 'db.log', offset: 50, size: 50 },
  ];
  const snap = snapshotStates(states);
  assert.equal(snap[path.resolve('app.log')], 100);
  assert.equal(snap[path.resolve('db.log')], 50);
});

test('applyToStates: sets state.offset from checkpoint', () => {
  const states = [
    { path: 'a.log', offset: 0, size: 1000 },
    { path: 'b.log', offset: 0, size: 500 },
  ];
  const cp = {
    [path.resolve('a.log')]: 800,
    [path.resolve('b.log')]: 200,
  };
  const stderr = captureStream();
  const n = applyToStates(states, cp, { stderr });
  assert.equal(n, 2);
  assert.equal(states[0].offset, 800);
  assert.equal(states[1].offset, 200);
  assert.match(stderr.text(), /resumed a\.log at byte 800/);
});

test('applyToStates: clamps to current file size', () => {
  const states = [{ path: 'a.log', offset: 0, size: 100 }];
  const cp = { [path.resolve('a.log')]: 9999 };  // checkpoint past EOF
  applyToStates(states, cp, { stderr: captureStream() });
  assert.equal(states[0].offset, 100);  // clamped to size
});

test('applyToStates: empty checkpoint is no-op', () => {
  const states = [{ path: 'a.log', offset: 50, size: 100 }];
  applyToStates(states, {}, { stderr: captureStream() });
  assert.equal(states[0].offset, 50);
});
