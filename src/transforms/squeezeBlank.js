'use strict';

function makeSqueezeBlank({ enabled = true } = {}) {
  if (!enabled) return (line) => line;
  return function squeeze(line, ctx) {
    const s = ctx.getState('squeezeBlank', () => ({ wasBlank: false }));
    const isBlank = line.trim() === '';
    if (isBlank && s.wasBlank) return null;
    s.wasBlank = isBlank;
    return line;
  };
}

module.exports = { makeSqueezeBlank };
