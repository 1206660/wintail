'use strict';

function makeCollapseRepeats({ enabled = true } = {}) {
  if (!enabled) return (line) => line;
  return function collapse(line, ctx) {
    const s = ctx.getState('collapse', () => ({ last: null, count: 0 }));
    if (s.last !== null && line === s.last) {
      s.count++;
      return null;
    }
    let out = line;
    if (s.count > 0) {
      const word = s.count === 1 ? 'time' : 'times';
      out = `[wintail: previous line repeated ${s.count} ${word}]\n${line}`;
      s.count = 0;
    }
    s.last = line;
    return out;
  };
}

module.exports = { makeCollapseRepeats };
