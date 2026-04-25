'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { makeNotifier, parseSpec, buildToastScript, THROTTLE_MS } = require('../../src/transforms/notify.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('parseSpec: pattern only', () => {
  const s = parseSpec('Fatal');
  assert.equal(s.title, null);
  assert.equal(s.key, 'Fatal');
  assert.match('Fatal error', s.regex);
});

test('parseSpec: pattern=title', () => {
  const s = parseSpec('Fatal=My Alert');
  assert.equal(s.title, 'My Alert');
});

test('parseSpec: rejects empty pattern', () => {
  assert.throws(() => parseSpec('=title'));
});

test('parseSpec: rejects bad regex', () => {
  assert.throws(() => parseSpec('(unclosed'));
});

test('makeNotifier: empty specs is passthrough', () => {
  const n = makeNotifier([], { allowAnyPlatform: true, fire: () => { throw new Error('should not fire'); } });
  assert.equal(n('anything', { source: 's' }), 'anything');
});

test('makeNotifier: matching line fires once', () => {
  const fired = [];
  const n = makeNotifier(['Fatal'], {
    allowAnyPlatform: true,
    fire: (title, body) => fired.push({ title, body }),
    now: () => 1000,
  });
  n('Some Fatal error happened', { source: 'app.log' });
  assert.equal(fired.length, 1);
  assert.equal(fired[0].title, 'wintail: app.log');
  assert.match(fired[0].body, /Fatal error/);
});

test('makeNotifier: custom title used', () => {
  const fired = [];
  const n = makeNotifier(['Fatal=Production Alert'], {
    allowAnyPlatform: true,
    fire: (title, body) => fired.push({ title, body }),
    now: () => 0,
  });
  n('Fatal: db down', { source: 's' });
  assert.equal(fired[0].title, 'Production Alert');
});

test('makeNotifier: throttles within window', () => {
  let now = 1000;
  const fired = [];
  const n = makeNotifier(['err'], {
    allowAnyPlatform: true,
    fire: (_t, body) => fired.push(body),
    now: () => now,
  });
  n('err 1', { source: 's' }); now += 100;
  n('err 2', { source: 's' }); now += 100;
  n('err 3', { source: 's' });
  assert.equal(fired.length, 1);
  assert.equal(fired[0], 'err 1');
});

test('makeNotifier: fires again after throttle window', () => {
  let now = 1000;
  const fired = [];
  const n = makeNotifier(['err'], {
    allowAnyPlatform: true,
    fire: (_t, body) => fired.push(body),
    now: () => now,
  });
  n('err 1', { source: 's' });
  now += THROTTLE_MS + 1;
  n('err 2', { source: 's' });
  assert.deepEqual(fired, ['err 1', 'err 2']);
});

test('makeNotifier: non-Windows = no-op + warning', () => {
  const stderr = captureStream();
  const n = makeNotifier(['x'], { platform: 'linux', stderr });
  assert.equal(n('x matches', { source: 's' }), 'x matches');
  assert.match(stderr.text(), /requires Windows/);
});

test('makeNotifier: line passthrough always', () => {
  const n = makeNotifier(['x'], { allowAnyPlatform: true, fire: () => {}, now: () => 0 });
  assert.equal(n('x line', { source: 's' }), 'x line');
  assert.equal(n('no match', { source: 's' }), 'no match');
});

test('buildToastScript: XML-escapes special chars', () => {
  const s = buildToastScript('Title <ok>', "Body & 'with quote'");
  assert.match(s, /&lt;ok&gt;/);
  assert.match(s, /&amp;/);
  assert.match(s, /&apos;with quote&apos;/);
});

test('buildToastScript: truncates long bodies', () => {
  const long = 'x'.repeat(500);
  const s = buildToastScript('t', long);
  const m = s.match(/<text>(x+)<\/text>/);
  assert.ok(m);
  assert.equal(m[1].length, 200);
});
