'use strict';

const { makeWrap } = require('./color.js');

const CONTROL = /[\x00-\x08\x0B-\x1F\x7F]/g;

function makeShowNonPrinting({ enabled = true, color = false } = {}) {
  if (!enabled) return (line) => line;
  const wrap = makeWrap(color);
  return function show(line) {
    return line.replace(CONTROL, (c) => {
      const code = c.charCodeAt(0);
      let glyph;
      if (code === 127) glyph = '^?';
      else if (code < 32) glyph = `^${String.fromCharCode(code + 64)}`;
      else glyph = `\\x${code.toString(16).padStart(2, '0').toUpperCase()}`;
      return wrap(glyph, '2;33');  // dim yellow
    });
  };
}

module.exports = { makeShowNonPrinting };
