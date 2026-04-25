'use strict';

function makeSample({ every = 1, enabled = true } = {}) {
  if (!enabled || !every || every <= 1) return (line) => line;
  return function sample(line, ctx) {
    const s = ctx.getState('sample', () => ({ n: 0 }));
    s.n++;
    if (s.n % every === 0) return line;
    return null;
  };
}

module.exports = { makeSample };
