'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRegexExtract } = require('../../src/transforms/regexExtract.js');

test('extracts single capture group', () => {
  const f = makeRegexExtract({ pattern: 'user=(\\w+)' });
  assert.equal(f('login user=alice from ip 1.2.3.4'), 'alice');
});

test('extracts multiple capture groups joined by space', () => {
  const f = makeRegexExtract({ pattern: 'user=(\\w+).+ip\\s+(\\d+\\.\\d+\\.\\d+\\.\\d+)' });
  assert.equal(f('login user=alice from ip 1.2.3.4'), 'alice 1.2.3.4');
});

test('returns full match when no capture group', () => {
  const f = makeRegexExtract({ pattern: 'https?://\\S+' });
  assert.equal(f('see https://example.com/foo for details'), 'https://example.com/foo');
});

test('drops non-matching lines by default', () => {
  const f = makeRegexExtract({ pattern: 'ERROR: (.*)' });
  assert.equal(f('plain log line'), null);
});

test('keepNonMatch passes through unmatched', () => {
  const f = makeRegexExtract({ pattern: 'ERROR: (.*)', keepNonMatch: true });
  assert.equal(f('plain log line'), 'plain log line');
  assert.equal(f('ERROR: boom'), 'boom');
});

test('case-insensitive', () => {
  const f = makeRegexExtract({ pattern: 'error: (.*)', ignoreCase: true });
  assert.equal(f('Error: oh no'), 'oh no');
});

test('custom separator', () => {
  const f = makeRegexExtract({ pattern: '(\\w+)=(\\d+)', separator: ' -> ' });
  assert.equal(f('count=42'), 'count -> 42');
});

test('empty pattern is passthrough', () => {
  const f = makeRegexExtract({});
  assert.equal(f('any line'), 'any line');
});

test('invalid regex throws', () => {
  assert.throws(() => makeRegexExtract({ pattern: '(unclosed' }), /invalid pattern/);
});
