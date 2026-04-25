'use strict';

const { makeWrap } = require('./color.js');

const FORMATS = new Set(['time', 'iso', 'epoch', 'epoch-ms']);

function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function pad3(n) { return n < 10 ? '00' + n : n < 100 ? '0' + n : '' + n; }

function fmtTime(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function fmtIso(d) {
  return d.toISOString();
}

function fmtEpoch(d) {
  return Math.floor(d.getTime() / 1000).toString();
}

function fmtEpochMs(d) {
  return d.getTime().toString();
}

function makeAddTimestamp({ format = 'time', enabled = true, now = () => new Date(), color = false } = {}) {
  if (!FORMATS.has(format)) {
    throw new Error(`unknown --add-timestamp format: ${format}`);
  }
  if (!enabled) return (line) => line;
  const wrap = makeWrap(color);
  const fmt = format === 'iso' ? fmtIso
            : format === 'epoch' ? fmtEpoch
            : format === 'epoch-ms' ? fmtEpochMs
            : fmtTime;
  return function addTimestamp(line) {
    const stamp = wrap(fmt(now()), '2');
    return `${stamp} ${line}`;
  };
}

module.exports = { makeAddTimestamp, FORMATS };
