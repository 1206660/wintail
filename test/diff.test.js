'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { emitDiff, makeBag, diffMultisets } = require('../src/diff.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wintail-diff-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let counter = 0;
function tmpFile(content) {
  const p = path.join(TMP, `f${counter++}.log`);
  fs.writeFileSync(p, content);
  return p;
}

test('makeBag counts duplicates', () => {
  const m = makeBag(['a', 'b', 'a', 'c', 'a']);
  assert.equal(m.get('a'), 3);
  assert.equal(m.get('b'), 1);
});

test('diffMultisets: only-A and only-B', () => {
  const a = makeBag(['x', 'y', 'common']);
  const b = makeBag(['z', 'common']);
  const d = diffMultisets(a, b);
  assert.equal(d.onlyA.get('x'), 1);
  assert.equal(d.onlyA.get('y'), 1);
  assert.equal(d.onlyB.get('z'), 1);
  assert.equal(d.both.get('common'), 1);
});

test('diffMultisets: duplicate-aware (one extra of x in A)', () => {
  const a = makeBag(['x', 'x', 'x', 'y']);
  const b = makeBag(['x', 'y']);
  const d = diffMultisets(a, b);
  assert.equal(d.onlyA.get('x'), 2);  // 3 - 1
});

test('emitDiff: writes header, then -/+ lines', () => {
  const a = tmpFile('apple\nbanana\ncherry\n');
  const b = tmpFile('apple\ndurian\ncherry\n');
  const out = [];
  emitDiff(a, b, { write: (s) => out.push(s) });
  const text = out.join('');
  assert.match(text, new RegExp(`--- .*${path.basename(a)}`));
  assert.match(text, new RegExp(`\\+\\+\\+ .*${path.basename(b)}`));
  assert.match(text, /-banana/);
  assert.match(text, /\+durian/);
  assert.doesNotMatch(text, /apple/);  // common, suppressed by default
  assert.doesNotMatch(text, /cherry/);
});

test('emitDiff: showCommon includes unchanged lines', () => {
  const a = tmpFile('shared\nonlyA\n');
  const b = tmpFile('shared\nonlyB\n');
  const out = [];
  emitDiff(a, b, { showCommon: true, write: (s) => out.push(s) });
  const text = out.join('');
  assert.match(text, / shared/);
  assert.match(text, /-onlyA/);
  assert.match(text, /\+onlyB/);
});

test('emitDiff: identical files have no -/+ lines', () => {
  const same = 'one\ntwo\nthree\n';
  const a = tmpFile(same);
  const b = tmpFile(same);
  const out = [];
  emitDiff(a, b, { write: (s) => out.push(s) });
  const body = out.join('').split('\n').slice(2);  // skip headers
  assert.ok(body.every(l => !l.startsWith('-') && !l.startsWith('+')));
});
