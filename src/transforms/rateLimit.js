'use strict';

function makeRateLimit({ perSec = 0, enabled = true, now = () => Date.now() } = {}) {
  if (!enabled || !perSec || perSec <= 0) return (line) => line;
  return function limit(line, ctx) {
    const s = ctx.getState('rateLimit', () => ({ windowStart: now(), count: 0, dropped: 0 }));
    const t = now();
    if (t - s.windowStart >= 1000) {
      const droppedThisWindow = s.dropped;
      s.windowStart = t;
      s.count = 1;
      s.dropped = 0;
      if (droppedThisWindow > 0) {
        return `[wintail: ${droppedThisWindow} lines dropped (rate-limit ${perSec}/s)]\n${line}`;
      }
      return line;
    }
    s.count++;
    if (s.count > perSec) {
      s.dropped++;
      return null;
    }
    return line;
  };
}

module.exports = { makeRateLimit };
