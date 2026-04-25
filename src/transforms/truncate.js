'use strict';

const ANSI_RE = /\x1b\[[0-9;]*m/g;
const RESET = '\x1b[0m';

function visibleLength(s) {
  return s.replace(ANSI_RE, '').length;
}

function truncateVisible(s, max, ellipsis = '…') {
  if (max <= 0) return ellipsis;
  let visible = 0;
  let i = 0;
  let hasColor = false;
  while (i < s.length) {
    if (s[i] === '\x1b' && s[i + 1] === '[') {
      const end = s.indexOf('m', i + 2);
      if (end !== -1) { hasColor = true; i = end + 1; continue; }
    }
    if (visible >= max - ellipsis.length) {
      return s.slice(0, i) + (hasColor ? RESET : '') + ellipsis;
    }
    visible++;
    i++;
  }
  return s;
}

function makeTruncate({ width, enabled = true, ellipsis = '…', stdout = process.stdout } = {}) {
  if (!enabled) return (line) => line;
  const resolved = (typeof width === 'number' && width > 0)
    ? width
    : (stdout && stdout.columns) || 80;
  return function truncate(line) {
    if (visibleLength(line) <= resolved) return line;
    return truncateVisible(line, resolved, ellipsis);
  };
}

module.exports = { makeTruncate, visibleLength, truncateVisible };
