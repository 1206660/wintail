'use strict';

const { makeWrap } = require('./color.js');

function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function fmtTime(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function expandTemplate(template, ctx, now) {
  return template
    .replace(/\{source\}/g, ctx.source)
    .replace(/\{time\}/g, fmtTime(now));
}

function makePrefix({ template = '', enabled = true, color = false, now = () => new Date() } = {}) {
  if (!enabled || !template) return (line) => line;
  const wrap = makeWrap(color);
  return function prefix(line, ctx) {
    const stamp = expandTemplate(template, ctx, now());
    return `${wrap(stamp, '2')}${line}`;
  };
}

module.exports = { makePrefix, expandTemplate };
