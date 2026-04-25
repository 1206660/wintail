'use strict';

const fs = require('node:fs');
const { makeWrap } = require('./transforms/color.js');

function readLines(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return text.split(/\r?\n/);
}

function makeBag(lines) {
  // Multiset (counts) so duplicate-aware diff works.
  const m = new Map();
  for (const line of lines) {
    if (line === '') continue;  // ignore trailing blank from final newline
    m.set(line, (m.get(line) || 0) + 1);
  }
  return m;
}

function diffMultisets(a, b) {
  // Return { onlyA: Map, onlyB: Map, both: Map } — counts in each side
  const onlyA = new Map();
  const onlyB = new Map();
  const both = new Map();
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const k of keys) {
    const ca = a.get(k) || 0;
    const cb = b.get(k) || 0;
    if (ca > cb) onlyA.set(k, ca - cb);
    else if (cb > ca) onlyB.set(k, cb - ca);
    if (Math.min(ca, cb) > 0) both.set(k, Math.min(ca, cb));
  }
  return { onlyA, onlyB, both };
}

function emitDiff(pathA, pathB, {
  showCommon = false,
  color = false,
  write = (s) => process.stdout.write(s),
} = {}) {
  const a = readLines(pathA);
  const b = readLines(pathB);
  const bagA = makeBag(a);
  const bagB = makeBag(b);
  const d = diffMultisets(bagA, bagB);

  const wrap = makeWrap(color);

  write(wrap(`--- ${pathA}\n`, '1;31'));
  write(wrap(`+++ ${pathB}\n`, '1;32'));

  // For each line preserving order of A, show '-' if in onlyA
  for (const line of a) {
    if (line === '') continue;
    if (d.onlyA.has(line) && d.onlyA.get(line) > 0) {
      write(wrap(`-${line}\n`, '31'));
      d.onlyA.set(line, d.onlyA.get(line) - 1);
    } else if (showCommon) {
      write(` ${line}\n`);
    }
  }
  // Then show all '+' lines from B in B's order
  for (const line of b) {
    if (line === '') continue;
    if (d.onlyB.has(line) && d.onlyB.get(line) > 0) {
      write(wrap(`+${line}\n`, '32'));
      d.onlyB.set(line, d.onlyB.get(line) - 1);
    }
  }
}

module.exports = { emitDiff, makeBag, diffMultisets, readLines };
