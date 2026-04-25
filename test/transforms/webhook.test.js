'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  makeWebhook, parseSpec, detectFormat, buildPayload, THROTTLE_MS,
} = require('../../src/transforms/webhook.js');

test('detectFormat: slack url', () => {
  assert.equal(detectFormat('https://hooks.slack.com/services/T01/B02/abc'), 'slack');
});

test('detectFormat: discord url', () => {
  assert.equal(detectFormat('https://discord.com/api/webhooks/123/abc'), 'discord');
  assert.equal(detectFormat('https://discordapp.com/api/webhooks/123/abc'), 'discord');
});

test('detectFormat: generic url', () => {
  assert.equal(detectFormat('https://example.com/hook'), 'generic');
});

test('parseSpec: pattern=url', () => {
  const s = parseSpec('Fatal=https://example.com/hook');
  assert.equal(s.url, 'https://example.com/hook');
  assert.equal(s.format, 'generic');
  assert.match('Fatal error', s.regex);
});

test('parseSpec: rejects missing url', () => {
  assert.throws(() => parseSpec('Fatal='), /must start with http/);
});

test('parseSpec: rejects missing pattern', () => {
  assert.throws(() => parseSpec('=https://x.com'), /empty pattern/);
});

test('parseSpec: rejects non-http url', () => {
  assert.throws(() => parseSpec('Foo=ftp://x.com'), /must start with http/);
});

test('parseSpec: rejects invalid regex', () => {
  assert.throws(() => parseSpec('(unclosed=https://x.com'), /invalid regex/);
});

test('buildPayload: slack format wraps in code block', () => {
  const p = buildPayload('slack', 'app.log', '\x1b[31mERROR\x1b[0m: boom');
  assert.match(p.text, /wintail · app\.log/);
  assert.match(p.text, /ERROR: boom/);  // ANSI stripped
  assert.doesNotMatch(p.text, /\x1b\[/);
});

test('buildPayload: discord format', () => {
  const p = buildPayload('discord', 'app.log', 'Fatal: oh no');
  assert.match(p.content, /\*\*wintail · app\.log\*\*/);
  assert.match(p.content, /Fatal: oh no/);
});

test('buildPayload: generic format', () => {
  const fixed = new Date(Date.UTC(2026, 3, 26, 10, 0, 0));
  const p = buildPayload('generic', 'app.log', 'a line', fixed);
  assert.equal(p.source, 'app.log');
  assert.equal(p.line, 'a line');
  assert.equal(p.timestamp, '2026-04-26T10:00:00.000Z');
});

test('makeWebhook: empty specs is passthrough', () => {
  const calls = [];
  const w = makeWebhook([], { post: (...a) => calls.push(a), now: () => 0 });
  assert.equal(w('any', { source: 's' }), 'any');
  assert.equal(calls.length, 0);
});

test('makeWebhook: posts on match with correct payload', async () => {
  const calls = [];
  const w = makeWebhook(['Fatal=https://hooks.slack.com/services/x'], {
    post: (url, payload) => calls.push({ url, payload }),
    now: () => 1000,
  });
  w('FATAL not matching case', { source: 's' });   // case-sensitive default — no match
  w('Fatal: down', { source: 'app.log' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /hooks\.slack\.com/);
  assert.match(calls[0].payload.text, /Fatal: down/);
});

test('makeWebhook: throttles within 5s window', async () => {
  let now = 1000;
  const calls = [];
  const w = makeWebhook(['err=https://x.com/a'], {
    post: (url, p) => calls.push(p), now: () => now,
  });
  w('err 1', { source: 's' }); now += 100;
  w('err 2', { source: 's' }); now += 100;
  w('err 3', { source: 's' });
  assert.equal(calls.length, 1);
});

test('makeWebhook: fires again after throttle window', async () => {
  let now = 1000;
  const calls = [];
  const w = makeWebhook(['err=https://x.com/a'], {
    post: (url, p) => calls.push(p), now: () => now,
  });
  w('err 1', { source: 's' });
  now += THROTTLE_MS + 1;
  w('err 2', { source: 's' });
  assert.equal(calls.length, 2);
});

test('makeWebhook: line passthrough always (including non-matching)', () => {
  const w = makeWebhook(['x=https://x.com/a'], { post: () => {}, now: () => 0 });
  assert.equal(w('x line', { source: 's' }), 'x line');
  assert.equal(w('no match', { source: 's' }), 'no match');
});

test('makeWebhook: independent throttle per spec', () => {
  let now = 1000;
  const calls = [];
  const w = makeWebhook([
    'a=https://x.com/a',
    'b=https://x.com/b',
  ], { post: (url, p) => calls.push(url), now: () => now });
  w('a hit', { source: 's' });
  w('b hit', { source: 's' });  // different spec, independent throttle
  assert.equal(calls.length, 2);
});
