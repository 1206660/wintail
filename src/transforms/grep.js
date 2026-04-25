'use strict';

function compilePattern(pattern, ignoreCase) {
  try { return new RegExp(pattern, ignoreCase ? 'i' : ''); }
  catch (e) { throw new Error(`invalid regex '${pattern}': ${e.message}`); }
}

function makeGrep({ patterns = [], ignoreCase = false, invert = false, mode = 'or' } = {}) {
  if (patterns.length === 0) return (line) => line;
  const compiled = patterns.map((p) => compilePattern(p, ignoreCase));
  const reduce = mode === 'and'
    ? (line) => compiled.every((r) => r.test(line))
    : (line) => compiled.some((r) => r.test(line));
  return function grep(line) {
    const m = reduce(line);
    if (invert) return m ? null : line;
    return m ? line : null;
  };
}

module.exports = { makeGrep, compilePattern };
