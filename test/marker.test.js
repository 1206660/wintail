'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { startMarker } = require('../src/marker.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('marker formats HH:MM:SS with separator', () => {
  const stderr = captureStream();
  const fixed = new Date(2026, 0, 1, 9, 5, 7);
  const m = startMarker({ intervalSec: 999, stderr, now: () => fixed });
  m._emit();
  m.stop();
  assert.match(stderr.text(), /─── 09:05:07 ───/);
});

test('intervalSec 0 returns no-op', () => {
  const stderr = captureStream();
  const m = startMarker({ intervalSec: 0, stderr });
  m.stop();
  assert.equal(stderr.text(), '');
});

test('color wraps separator dim', () => {
  const stderr = captureStream();
  const fixed = new Date(2026, 0, 1, 0, 0, 0);
  const m = startMarker({ intervalSec: 999, stderr, now: () => fixed, color: true });
  m._emit();
  m.stop();
  assert.match(stderr.text(), /\x1b\[2m─── 00:00:00 ───\x1b\[0m/);
});
