'use strict';

const MAX_LINE = 64 * 1024;

function looksLikeJson(line) {
  if (line.length > MAX_LINE) return false;
  const t = line.trim();
  if (t.length < 2) return false;
  const f = t.charCodeAt(0);
  const l = t.charCodeAt(t.length - 1);
  return (f === 0x7B && l === 0x7D) || (f === 0x5B && l === 0x5D);
}

function makePrettyJson({ indent = 2 } = {}) {
  return function prettyJson(line) {
    if (!looksLikeJson(line)) return line;
    const t = line.trim();
    let obj;
    try { obj = JSON.parse(t); }
    catch { return line; }
    if (obj === null || typeof obj !== 'object') return line;
    return JSON.stringify(obj, null, indent);
  };
}

module.exports = { makePrettyJson, looksLikeJson };
