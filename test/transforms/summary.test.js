'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { createSummary, normalizeLine } = require('../../src/transforms/summary.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('normalizeLine: replaces numbers', () => {
  assert.equal(normalizeLine('user 42 logged in 3 times'), 'user <N> logged in <N> times');
});

test('normalizeLine: replaces IP:port', () => {
  assert.equal(normalizeLine('connection from 192.168.1.50:3000 closed'), 'connection from <IP> closed');
});

test('normalizeLine: replaces ISO timestamp', () => {
  assert.equal(normalizeLine('[2026-04-26T10:30:45Z] event'), '[<TS>] event');
});

test('normalizeLine: replaces UE timestamp', () => {
  assert.equal(normalizeLine('[2024.01.15-10.30.45:123] LogTemp: x'), '<TS> LogTemp: x');
});

test('normalizeLine: replaces UUID', () => {
  assert.equal(normalizeLine('req-id 550e8400-e29b-41d4-a716-446655440000 done'), 'req-id <UUID> done');
});

test('normalizeLine: replaces hex pointers', () => {
  assert.equal(normalizeLine('crash at 0xdeadbeef in 0x12345'), 'crash at <HEX> in <HEX>');
  assert.equal(normalizeLine('hash deadbeef0123456789abcdef'), 'hash <HEX>');
});

test('createSummary: counts unique patterns after normalization', () => {
  const s = createSummary();
  s.transform('login user 1 from 10.0.0.1');
  s.transform('login user 2 from 10.0.0.2');
  s.transform('login user 3 from 10.0.0.3');
  s.transform('logout user 1');
  const snap = s.snapshot();
  assert.equal(snap.total, 4);
  // 3 logins normalize to one pattern, logout is another → 2 unique
  assert.equal(snap.unique, 2);
});

test('createSummary: report shows top patterns sorted', () => {
  const s = createSummary({ topN: 3 });
  for (let i = 0; i < 5; i++) s.transform(`db query ${i}ms`);
  for (let i = 0; i < 3; i++) s.transform(`cache hit key${i}`);
  for (let i = 0; i < 1; i++) s.transform(`error: timeout ${i}`);
  const stderr = captureStream();
  s.report(stderr);
  const out = stderr.text();
  assert.match(out, /9 lines · 3 unique patterns/);
  assert.match(out, /5 \( 55\.6%\)  db query <N>ms/);
  assert.match(out, /3 \( 33\.3%\)  cache hit key<N>/);
});

test('createSummary: empty stream', () => {
  const s = createSummary();
  const stderr = captureStream();
  s.report(stderr);
  assert.match(stderr.text(), /0 lines/);
});

test('createSummary: normalize=false uses raw lines as keys', () => {
  const s = createSummary({ normalize: false });
  s.transform('user 1 login');
  s.transform('user 2 login');
  // Different keys without normalization
  assert.equal(s.snapshot().unique, 2);
});

test('createSummary: long patterns truncated in report', () => {
  const s = createSummary();
  s.transform('x'.repeat(200));
  const stderr = captureStream();
  s.report(stderr);
  const out = stderr.text();
  assert.match(out, /\.\.\./);
  // No line in report longer than ~130 chars
  for (const line of out.split('\n')) {
    assert.ok(line.length < 140, `too long: ${line.length}`);
  }
});
