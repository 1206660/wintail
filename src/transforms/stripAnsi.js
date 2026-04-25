'use strict';

const { stripAnsi } = require('../multiOut.js');

function makeStripAnsi({ enabled = true } = {}) {
  if (!enabled) return (line) => line;
  return function strip(line) {
    return stripAnsi(line);
  };
}

module.exports = { makeStripAnsi };
