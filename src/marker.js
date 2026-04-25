'use strict';

const { makeWrap } = require('./transforms/color.js');

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function startMarker({ intervalSec = 60, stderr = process.stderr, now = () => new Date(), color = false } = {}) {
  if (!intervalSec || intervalSec <= 0) return { stop: () => {} };
  const wrap = makeWrap(color);
  function emit() {
    const t = now();
    const stamp = `${pad2(t.getHours())}:${pad2(t.getMinutes())}:${pad2(t.getSeconds())}`;
    stderr.write(`${wrap(`─── ${stamp} ───`, '2')}\n`);
  }
  const handle = setInterval(emit, intervalSec * 1000);
  if (handle.unref) handle.unref();
  return { stop: () => clearInterval(handle), _emit: emit };
}

module.exports = { startMarker };
