'use strict';

function makeRegexExtract({ pattern = null, ignoreCase = false, keepNonMatch = false, separator = ' ' } = {}) {
  if (!pattern) return (line) => line;
  let regex;
  try { regex = new RegExp(pattern, ignoreCase ? 'i' : ''); }
  catch (e) { throw new Error(`--regex-extract invalid pattern '${pattern}': ${e.message}`); }
  return function extract(line) {
    const m = regex.exec(line);
    if (!m) return keepNonMatch ? line : null;
    if (m.length === 1) return m[0];
    return m.slice(1).map((g) => (g === undefined ? '' : g)).join(separator);
  };
}

module.exports = { makeRegexExtract };
