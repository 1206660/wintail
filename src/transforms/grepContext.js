'use strict';

const { compilePattern } = require('./grep.js');

const SEPARATOR = '--';

function makeGrepWithContext({
  patterns = [], ignoreCase = false, mode = 'or', invert = false,
  before = 0, after = 0, enabled = true,
} = {}) {
  if (!enabled || patterns.length === 0) return (line) => line;
  const compiled = patterns.map((p) => compilePattern(p, ignoreCase));
  const reduce = mode === 'and'
    ? (line) => compiled.every((r) => r.test(line))
    : (line) => compiled.some((r) => r.test(line));

  return function grepContext(line, ctx) {
    const s = ctx.getState('grepContext', () => ({
      ring: [],         // up to `before` recent non-matching lines
      afterLeft: 0,     // remaining "after" lines to emit
      lastWasEmit: false,
      ever: false,      // have we emitted anything yet
    }));

    const matches = reduce(line);
    const keep = invert ? !matches : matches;

    if (keep) {
      const out = [];
      if (s.ever && (before > 0 || after > 0) && !s.lastWasEmit) {
        // Coming back from a gap → separator
        out.push(SEPARATOR);
      }
      if (before > 0 && s.ring.length > 0) {
        out.push(...s.ring);
        s.ring.length = 0;
      }
      out.push(line);
      s.afterLeft = after;
      s.lastWasEmit = true;
      s.ever = true;
      return out.join('\n');
    }

    if (s.afterLeft > 0) {
      s.afterLeft--;
      s.lastWasEmit = true;
      return line;
    }

    // Not kept and no after-context: buffer for possible future before-context
    if (before > 0) {
      s.ring.push(line);
      while (s.ring.length > before) s.ring.shift();
    }
    s.lastWasEmit = false;
    return null;
  };
}

module.exports = { makeGrepWithContext, SEPARATOR };
