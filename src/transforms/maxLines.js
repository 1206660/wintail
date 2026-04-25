'use strict';

function makeMaxLines({ limit, onLimitReached = () => process.exit(0) } = {}) {
  if (!limit || limit <= 0) return (line) => line;
  let count = 0;
  let triggered = false;
  return function maxLines(line) {
    count++;
    if (count > limit) return null;
    if (count === limit && !triggered) {
      triggered = true;
      setImmediate(onLimitReached);
    }
    return line;
  };
}

module.exports = { makeMaxLines };
