'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Writable } = require('node:stream');
const { makeTicker, makeStateForFollow } = require('../src/follow.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wintail-follow-'));
let counter = 0;
function tmpPath() { return path.join(TMP, `f${counter++}.log`); }

function captureStream() {
  const chunks = [];
  const w = new Writable({
    write(chunk, _enc, cb) { chunks.push(Buffer.from(chunk)); cb(); }
  });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test('readAppended: append after follow start', () => {
  const p = tmpPath();
  fs.writeFileSync(p, 'old\n');
  const state = makeStateForFollow(p);
  const stdout = captureStream();
  const stderr = captureStream();
  const tick = makeTicker({
    files: [state], lastEmittedPath: null, showHeaders: false,
    opts: { follow: 'descriptor', sleepInterval: 1, pid: null },
    stdout, stderr,
  });
  fs.appendFileSync(p, 'new1\nnew2\n');
  tick();
  assert.equal(stdout.text(), 'new1\nnew2\n');
  fs.closeSync(state.fd);
});

test('readAppended: multiple appends', () => {
  const p = tmpPath();
  fs.writeFileSync(p, '');
  const state = makeStateForFollow(p);
  const stdout = captureStream();
  const stderr = captureStream();
  const tick = makeTicker({
    files: [state], lastEmittedPath: null, showHeaders: false,
    opts: { follow: 'descriptor', sleepInterval: 1, pid: null },
    stdout, stderr,
  });
  fs.appendFileSync(p, 'a\n');
  tick();
  fs.appendFileSync(p, 'b\nc\n');
  tick();
  assert.equal(stdout.text(), 'a\nb\nc\n');
  fs.closeSync(state.fd);
});

test('truncation: -f notices and resets', () => {
  const p = tmpPath();
  fs.writeFileSync(p, 'one\ntwo\nthree\n');
  const state = makeStateForFollow(p);
  const stdout = captureStream();
  const stderr = captureStream();
  const tick = makeTicker({
    files: [state], lastEmittedPath: null, showHeaders: false,
    opts: { follow: 'descriptor', sleepInterval: 1, pid: null },
    stdout, stderr,
  });
  fs.writeFileSync(p, 'fresh\n');
  tick();
  assert.match(stderr.text(), /file truncated/);
  assert.equal(stdout.text(), 'fresh\n');
  fs.closeSync(state.fd);
});

test('rotation: -F follows new file when path replaced', () => {
  const p = tmpPath();
  fs.writeFileSync(p, 'first\n');
  const state = makeStateForFollow(p);
  state.encoding = 'utf8';
  const stdout = captureStream();
  const stderr = captureStream();
  const tick = makeTicker({
    files: [state], lastEmittedPath: null, showHeaders: false,
    opts: { follow: 'name', sleepInterval: 1, pid: null },
    stdout, stderr,
  });
  fs.appendFileSync(p, 'before-rotate\n');
  tick();
  assert.equal(stdout.text(), 'before-rotate\n');

  // Simulate logrotate: move + create
  const rotated = p + '.1';
  fs.renameSync(p, rotated);
  fs.writeFileSync(p, 'fresh-after-rotate\n');
  // Bump mtime forward to ensure detection in case of fast operations
  const future = new Date(Date.now() + 10);
  fs.utimesSync(p, future, future);
  tick();
  assert.match(stderr.text(), /following new file/);
  assert.match(stdout.text(), /fresh-after-rotate/);
  if (state.fd !== null) fs.closeSync(state.fd);
});

test('rotation: -F detects deletion then reappearance', () => {
  const p = tmpPath();
  fs.writeFileSync(p, 'initial\n');
  const state = makeStateForFollow(p);
  const stdout = captureStream();
  const stderr = captureStream();
  const tick = makeTicker({
    files: [state], lastEmittedPath: null, showHeaders: false,
    opts: { follow: 'name', sleepInterval: 1, pid: null },
    stdout, stderr,
  });
  fs.unlinkSync(p);
  tick();
  assert.match(stderr.text(), /No such file or directory/);
  assert.equal(state.fd, null);

  fs.writeFileSync(p, 'reborn\n');
  tick();
  assert.match(stderr.text(), /has appeared/);
  assert.equal(stdout.text(), 'reborn\n');
  if (state.fd !== null) fs.closeSync(state.fd);
});

test('header switching: -v multi-file emits ==> path <==', () => {
  const a = tmpPath(); const b = tmpPath();
  fs.writeFileSync(a, ''); fs.writeFileSync(b, '');
  const sa = makeStateForFollow(a);
  const sb = makeStateForFollow(b);
  const stdout = captureStream();
  const tick = makeTicker({
    files: [sa, sb], lastEmittedPath: b, showHeaders: true,
    opts: { follow: 'descriptor', sleepInterval: 1, pid: null },
    stdout, stderr: captureStream(),
  });
  fs.appendFileSync(a, 'A1\n');
  fs.appendFileSync(b, 'B1\n');
  tick();
  const out = stdout.text();
  assert.match(out, new RegExp(`==> ${a.replace(/\\/g, '\\\\')} <==`));
  assert.match(out, new RegExp(`==> ${b.replace(/\\/g, '\\\\')} <==`));
  // 'A1' should appear before 'B1' (file order)
  assert.ok(out.indexOf('A1') < out.indexOf('B1'));
  fs.closeSync(sa.fd); fs.closeSync(sb.fd);
});

test('header not re-emitted for same file twice in a row', () => {
  const a = tmpPath();
  fs.writeFileSync(a, '');
  const sa = makeStateForFollow(a);
  const stdout = captureStream();
  const tick = makeTicker({
    files: [sa], lastEmittedPath: a, showHeaders: true,
    opts: { follow: 'descriptor', sleepInterval: 1, pid: null },
    stdout, stderr: captureStream(),
  });
  fs.appendFileSync(a, 'X\n');
  tick();
  fs.appendFileSync(a, 'Y\n');
  tick();
  const out = stdout.text();
  assert.equal(out, 'X\nY\n');
  fs.closeSync(sa.fd);
});
