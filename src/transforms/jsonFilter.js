'use strict';

function parsePath(s) {
  return s.split('.');
}

function getPath(obj, path) {
  let cur = obj;
  for (const p of path) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function parseSpec(s) {
  if (typeof s !== 'string' || s.length === 0) {
    throw new Error('--json-filter: empty spec');
  }
  // Operators in order of length so longer matches win
  const ops = [
    { op: '!~', match: (a, b) => !new RegExp(b).test(String(a)) },
    { op: '~',  match: (a, b) => new RegExp(b).test(String(a)) },
    { op: '!=', match: (a, b) => String(a) !== b },
    { op: '>=', match: (a, b) => Number(a) >= Number(b) },
    { op: '<=', match: (a, b) => Number(a) <= Number(b) },
    { op: '>',  match: (a, b) => Number(a) > Number(b) },
    { op: '<',  match: (a, b) => Number(a) < Number(b) },
    { op: '=',  match: (a, b) => String(a) === b },
  ];
  for (const { op, match } of ops) {
    const idx = s.indexOf(op);
    if (idx > 0) {
      const key = s.slice(0, idx);
      const val = s.slice(idx + op.length);
      return { path: parsePath(key), match: (v) => match(v, val), spec: s };
    }
  }
  // Just a key — value must exist
  return { path: parsePath(s), match: (v) => v !== undefined, spec: s };
}

function makeJsonFilter({ specs = [], keepNonJson = false } = {}) {
  if (specs.length === 0) return (line) => line;
  const conditions = specs.map(parseSpec);
  return function jsonFilter(line) {
    let obj;
    try { obj = JSON.parse(line); }
    catch { return keepNonJson ? line : null; }
    if (obj === null || typeof obj !== 'object') return keepNonJson ? line : null;
    for (const c of conditions) {
      const v = getPath(obj, c.path);
      if (!c.match(v)) return null;
    }
    return line;
  };
}

module.exports = { makeJsonFilter, parseSpec, getPath };
