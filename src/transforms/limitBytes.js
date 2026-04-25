'use strict';

function makeLimitBytes({ limit = 0, enabled = true, onLimitReached = () => process.exit(0) } = {}) {
  if (!enabled || !limit || limit <= 0) return (line) => line;
  let bytes = 0;
  let triggered = false;
  return function limit_(line) {
    const len = Buffer.byteLength(line, 'utf8') + 1; // +1 for the EOL the pipeline adds
    if (bytes >= limit) return null;
    bytes += len;
    if (bytes >= limit && !triggered) {
      triggered = true;
      setImmediate(onLimitReached);
    }
    return line;
  };
}

module.exports = { makeLimitBytes };
