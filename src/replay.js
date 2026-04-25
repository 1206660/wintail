'use strict';

const fs = require('node:fs');
const { parseTimestamp } = require('./timestamps.js');

const MAX_DELAY_MS = 5000;        // cap one inter-line gap to keep playback bearable
const FALLBACK_GAP_MS = 80;       // when no timestamps detectable

function readLinesSync(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0x0A) {
      lines.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) lines.push(text.slice(start));
  return lines;
}

async function replayFile(filePath, {
  rate = 1,
  maxDelay = MAX_DELAY_MS,
  fallbackGap = FALLBACK_GAP_MS,
  write = (s) => process.stdout.write(s),
  sleep = (ms) => new Promise(r => setTimeout(r, ms)),
} = {}) {
  if (rate <= 0) throw new Error(`--replay rate must be > 0 (got ${rate})`);
  const lines = readLinesSync(filePath);
  let prevTs = null;
  for (const line of lines) {
    const ts = parseTimestamp(line);
    if (prevTs !== null) {
      let delayMs;
      if (ts !== null) {
        delayMs = Math.max(0, (ts - prevTs)) / rate;
      } else {
        delayMs = fallbackGap / rate;
      }
      if (delayMs > maxDelay) delayMs = maxDelay;
      if (delayMs > 0) await sleep(delayMs);
    } else if (ts === null) {
      // Pre-stream gap when first lines have no timestamps
      await sleep(fallbackGap / rate);
    }
    write(line);
    if (ts !== null) prevTs = ts;
  }
}

module.exports = { replayFile, readLinesSync, MAX_DELAY_MS, FALLBACK_GAP_MS };
