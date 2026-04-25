'use strict';

function makeLineNumberer() {
  return function lineNumber(line, ctx) {
    const s = ctx.getState('lineNumber', () => ({ n: 0 }));
    s.n++;
    return `${s.n}\t${line}`;
  };
}

module.exports = { makeLineNumberer };
