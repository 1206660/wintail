'use strict';

function makeUnique({ enabled = true, maxKeys = 100000 } = {}) {
  if (!enabled) return (line) => line;
  return function unique(line, ctx) {
    const s = ctx.getState('unique', () => ({ seen: new Set() }));
    if (s.seen.has(line)) return null;
    if (s.seen.size >= maxKeys) {
      // Don't grow unbounded; once we hit the cap, become passthrough.
      return line;
    }
    s.seen.add(line);
    return line;
  };
}

module.exports = { makeUnique };
