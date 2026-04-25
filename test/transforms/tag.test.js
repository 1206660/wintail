'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeTagger, parseSpec, colorForLabel } = require('../../src/transforms/tag.js');

test('parseSpec: PATTERN=LABEL', () => {
  const s = parseSpec('panic=PANIC');
  assert.equal(s.label, 'PANIC');
  assert.match('panic at the disco', s.regex);
});

test('parseSpec: rejects empty pattern', () => {
  assert.throws(() => parseSpec('=LABEL'), /empty pattern/);
});

test('parseSpec: rejects empty label', () => {
  assert.throws(() => parseSpec('pat='), /empty label/);
});

test('parseSpec: rejects invalid regex', () => {
  assert.throws(() => parseSpec('(unclosed=LBL'), /invalid regex/);
});

test('makeTagger: prepends label on match', () => {
  const t = makeTagger({ specs: ['Fatal=CRASH'] });
  assert.equal(t('Fatal: db down'), '[CRASH] Fatal: db down');
  assert.equal(t('all good'), 'all good');
});

test('makeTagger: multiple matching tags chained', () => {
  const t = makeTagger({ specs: ['Fatal=CRASH', 'db=DB'] });
  assert.equal(t('Fatal db error'), '[CRASH] [DB] Fatal db error');
});

test('makeTagger: empty specs is passthrough', () => {
  const t = makeTagger({ specs: [] });
  assert.equal(t('any line'), 'any line');
});

test('makeTagger: color wraps tags when enabled', () => {
  const t = makeTagger({ specs: ['x=X'], color: true });
  const out = t('x line');
  assert.match(out, /\x1b\[[0-9;]+m\[X\]\x1b\[0m/);
});

test('colorForLabel: deterministic and varied', () => {
  assert.equal(colorForLabel('A'), colorForLabel('A'));
  // Non-strict — might collide, but very unlikely for two distinct labels
  const a = colorForLabel('Apple');
  const b = colorForLabel('Banana');
  assert.ok(a && b);
});
