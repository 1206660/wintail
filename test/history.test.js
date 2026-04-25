'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Writable, Readable } = require('node:stream');

// Override historyDir() via temp HOME / LOCALAPPDATA before requiring the module
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wintail-history-'));
process.env.LOCALAPPDATA = TMP;
process.env.HOME = TMP;
process.env.USERPROFILE = TMP;

const {
  recordInvocation, readHistory, recentUnique, formatRow,
  pickFromHistory, listHistory, historyPath,
} = require('../src/history.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

function readableFromString(s) {
  const r = Readable.from([Buffer.from(s, 'utf8')]);
  r.isTTY = true;
  return r;
}

function clearHistory() {
  try { fs.unlinkSync(historyPath()); } catch {}
}

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test('records and reads back invocations', () => {
  clearHistory();
  recordInvocation(['-F', 'app.log']);
  recordInvocation(['-n', '50', 'b.log']);
  const h = readHistory();
  assert.equal(h.length, 2);
  assert.deepEqual(h[0].args, ['-F', 'app.log']);
  assert.deepEqual(h[1].args, ['-n', '50', 'b.log']);
});

test('skip option does not record', () => {
  clearHistory();
  recordInvocation(['-F', 'a.log'], { skip: true });
  assert.equal(readHistory().length, 0);
});

test('empty argv does not record', () => {
  clearHistory();
  recordInvocation([]);
  assert.equal(readHistory().length, 0);
});

test('recentUnique drops duplicate args, preserves order', () => {
  const entries = [
    { ts: 't1', args: ['a'] },
    { ts: 't2', args: ['b'] },
    { ts: 't3', args: ['a'] },
    { ts: 't4', args: ['c'] },
    { ts: 't5', args: ['b'] },
  ];
  const top3 = recentUnique(entries, 3);
  // most recent unique ['a','c','b'] but in chronological order: a@t3, c@t4, b@t5
  assert.deepEqual(top3.map(e => e.args), [['a'], ['c'], ['b']]);
});

test('formatRow includes index, timestamp, command', () => {
  const row = formatRow(1, { ts: '2026-04-26T10:30:45.000Z', args: ['-F', 'app.log'] });
  assert.match(row, / 1\) /);
  assert.match(row, /wintail -F app\.log/);
});

test('pickFromHistory: returns most recent on empty stdin (Enter)', async () => {
  clearHistory();
  recordInvocation(['-n', '5', 'a.log']);
  recordInvocation(['-F', 'b.log']);
  const stdin = readableFromString('\n');
  const stdout = captureStream();
  const stderr = captureStream();
  const picked = await pickFromHistory({ stdin, stdout, stderr });
  assert.deepEqual(picked.args, ['-F', 'b.log']);
  assert.match(stdout.text(), /Recent wintail commands/);
});

test('pickFromHistory: numeric selection picks that entry', async () => {
  clearHistory();
  recordInvocation(['-n', '5', 'a.log']);
  recordInvocation(['-F', 'b.log']);
  const stdin = readableFromString('1\n');
  const stdout = captureStream();
  const stderr = captureStream();
  const picked = await pickFromHistory({ stdin, stdout, stderr });
  assert.deepEqual(picked.args, ['-n', '5', 'a.log']);
});

test('pickFromHistory: empty history → null + warning', async () => {
  clearHistory();
  const stderr = captureStream();
  const picked = await pickFromHistory({ stderr });
  assert.equal(picked, null);
  assert.match(stderr.text(), /no history/);
});

test('pickFromHistory: preselect index out of range', async () => {
  clearHistory();
  recordInvocation(['-F', 'a.log']);
  const stderr = captureStream();
  const picked = await pickFromHistory({ preselect: 99, stderr, stdout: captureStream() });
  assert.equal(picked, null);
  assert.match(stderr.text(), /out of range/);
});

test('pickFromHistory: preselect=1 picks the most recent', async () => {
  clearHistory();
  recordInvocation(['-n', '5', 'a.log']);
  recordInvocation(['-F', 'b.log']);
  const picked = await pickFromHistory({ preselect: 2, stdout: captureStream(), stderr: captureStream() });
  // recent list is chronological: [a, b]; preselect 2 = 'b' (most recent)
  assert.deepEqual(picked.args, ['-F', 'b.log']);
});

test('pickFromHistory: ignores --resume entries from history', async () => {
  clearHistory();
  recordInvocation(['-F', 'good.log']);
  recordInvocation(['--resume']);
  recordInvocation(['--resume=1']);
  const picked = await pickFromHistory({ preselect: 1, stdout: captureStream(), stderr: captureStream() });
  assert.deepEqual(picked.args, ['-F', 'good.log']);
});

test('pickFromHistory: non-TTY stdin picks most recent silently', async () => {
  clearHistory();
  recordInvocation(['-F', 'a.log']);
  recordInvocation(['-n', '20', 'b.log']);
  const stdin = readableFromString('');
  stdin.isTTY = false;
  const stdout = captureStream();
  const picked = await pickFromHistory({ stdin, stdout, stderr: captureStream() });
  assert.deepEqual(picked.args, ['-n', '20', 'b.log']);
});

test('listHistory: prints all entries', () => {
  clearHistory();
  recordInvocation(['-F', 'a.log']);
  recordInvocation(['-n', '5', 'b.log']);
  const stdout = captureStream();
  listHistory({ stdout });
  assert.match(stdout.text(), /a\.log/);
  assert.match(stdout.text(), /b\.log/);
});

test('listHistory: empty', () => {
  clearHistory();
  const stdout = captureStream();
  listHistory({ stdout });
  assert.match(stdout.text(), /no history/);
});
