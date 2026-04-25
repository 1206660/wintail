'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { createPipeline } = require('../src/output.js');
const { startWatch } = require('../src/watch.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('rejects empty command', () => {
  assert.throws(() => startWatch({ command: '', pipeline: { writeChunk: () => {} } }), /non-empty string/);
});

test('runs command immediately on start (one tick)', () => {
  const stdout = captureStream();
  const stderr = captureStream();
  const pipeline = createPipeline({ transforms: [], stdout });
  let calls = 0;
  const fakeShell = () => { calls++; return { stdout: 'pod-1 Running\n', stderr: '', error: null }; };
  const w = startWatch({
    command: 'echo test',
    intervalSec: 99,  // long, so only the immediate tick runs
    pipeline,
    stderr,
    runShell: fakeShell,
  });
  try {
    assert.equal(calls, 1);
    assert.equal(stdout.text(), 'pod-1 Running\n');
  } finally { w.stop(); }
});

test('appends trailing newline if missing', () => {
  const stdout = captureStream();
  const pipeline = createPipeline({ transforms: [], stdout });
  const fakeShell = () => ({ stdout: 'no-newline', stderr: '', error: null });
  const w = startWatch({ command: 'x', intervalSec: 99, pipeline, runShell: fakeShell, stderr: captureStream() });
  try { assert.equal(stdout.text(), 'no-newline\n'); } finally { w.stop(); }
});

test('forwards stderr from command', () => {
  const stderr = captureStream();
  const pipeline = createPipeline({ transforms: [], stdout: captureStream() });
  const fakeShell = () => ({ stdout: '', stderr: 'cmd: bad arg\n', error: null });
  const w = startWatch({ command: 'x', intervalSec: 99, pipeline, runShell: fakeShell, stderr });
  try { assert.match(stderr.text(), /bad arg/); } finally { w.stop(); }
});

test('reports spawn error to stderr', () => {
  const stderr = captureStream();
  const pipeline = createPipeline({ transforms: [], stdout: captureStream() });
  const fakeShell = () => ({ stdout: '', stderr: '', error: new Error('ENOENT cmd not found') });
  const w = startWatch({ command: 'nope', intervalSec: 99, pipeline, runShell: fakeShell, stderr });
  try { assert.match(stderr.text(), /ENOENT cmd not found/); } finally { w.stop(); }
});

test('manual tick re-runs command', () => {
  const stdout = captureStream();
  const pipeline = createPipeline({ transforms: [], stdout });
  let counter = 0;
  const fakeShell = () => { counter++; return { stdout: `tick-${counter}\n`, stderr: '', error: null }; };
  const w = startWatch({ command: 'x', intervalSec: 99, pipeline, runShell: fakeShell, stderr: captureStream() });
  try {
    w._tickForTest();
    w._tickForTest();
    const lines = stdout.text().split('\n').filter(Boolean);
    assert.deepEqual(lines, ['tick-1', 'tick-2', 'tick-3']);
    assert.equal(w.getStats().runs, 3);
  } finally { w.stop(); }
});

test('emitHeader callback fires per output run', () => {
  const stdout = captureStream();
  const pipeline = createPipeline({ transforms: [], stdout });
  const headerCalls = [];
  const fakeShell = () => ({ stdout: 'data\n', stderr: '', error: null });
  const w = startWatch({
    command: 'cmd',
    intervalSec: 99,
    pipeline,
    runShell: fakeShell,
    emitHeader: (s) => headerCalls.push(s),
    stderr: captureStream(),
  });
  try {
    w._tickForTest();
    assert.equal(headerCalls.length, 2);  // one immediate + one manual
    assert.match(headerCalls[0], /\$\(cmd\)/);
  } finally { w.stop(); }
});

test('long command truncated in source name', () => {
  const stdout = captureStream();
  const pipeline = createPipeline({ transforms: [], stdout });
  const fakeShell = () => ({ stdout: 'x\n', stderr: '', error: null });
  const longCmd = 'kubectl get pods -A -o wide --sort-by=metadata.creationTimestamp | head';
  const w = startWatch({
    command: longCmd,
    intervalSec: 99,
    pipeline,
    runShell: fakeShell,
    stderr: captureStream(),
  });
  try {
    assert.ok(w.source.length < longCmd.length + 5);
    assert.ok(w.source.endsWith('...)') || w.source.endsWith(longCmd + ')'));
  } finally { w.stop(); }
});
