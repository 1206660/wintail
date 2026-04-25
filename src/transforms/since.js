'use strict';

const { parseTimestamp, parseSpec } = require('../timestamps.js');

function makeSinceFilter({ since, until } = {}) {
  const sinceMs = since !== undefined ? parseSpec(since) : null;
  const untilMs = until !== undefined ? parseSpec(until) : null;
  if (sinceMs === null && untilMs === null) return (line) => line;

  return function sinceFilter(line, ctx) {
    const s = ctx.getState('since', () => ({ last: null }));
    const t = parseTimestamp(line);
    const effective = t !== null ? t : s.last;
    if (t !== null) s.last = t;
    if (effective === null) return line;
    if (sinceMs !== null && effective < sinceMs) return null;
    if (untilMs !== null && effective > untilMs) return null;
    return line;
  };
}

module.exports = { makeSinceFilter };
