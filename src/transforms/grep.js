'use strict';

function compilePattern(pattern, ignoreCase) {
  try { return new RegExp(pattern, ignoreCase ? 'i' : ''); }
  catch (e) { throw new Error(`invalid regex '${pattern}': ${e.message}`); }
}

function makeGrep({ patterns = [], ignoreCase = false, invert = false } = {}) {
  if (patterns.length === 0) return (line) => line;
  const compiled = patterns.map((p) => compilePattern(p, ignoreCase));
  return function grep(line) {
    const anyMatch = compiled.some((r) => r.test(line));
    if (invert) return anyMatch ? null : line;
    return anyMatch ? line : null;
  };
}

module.exports = { makeGrep, compilePattern };
