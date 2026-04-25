'use strict';

const RE_IP_PORT = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\b/g;
const RE_ISO_TS = /\b\d{4}[-/.]\d{2}[-/.]\d{2}[T \-]\d{2}[:.]\d{2}[:.]\d{2}(?:[.,]\d+)?(?:Z|[+\-]\d{2}:?\d{2})?\b/g;
const RE_UE_TS = /\[\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}(?::\d{3})?\]/g;
const RE_HEX_LONG = /\b[a-fA-F0-9]{16,}\b/g;
const RE_UUID = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;
const RE_NUM = /\d+(?:\.\d+)?/g;
const RE_HEX_NUM = /\b0x[0-9a-fA-F]+\b/g;

function normalizeLine(line) {
  return line
    .replace(RE_UE_TS, '<TS>')
    .replace(RE_ISO_TS, '<TS>')
    .replace(RE_IP_PORT, '<IP>')
    .replace(RE_UUID, '<UUID>')
    .replace(RE_HEX_LONG, '<HEX>')
    .replace(RE_HEX_NUM, '<HEX>')
    .replace(RE_NUM, '<N>');
}

function createSummary({ topN = 10, normalize = true } = {}) {
  const counts = new Map();
  let total = 0;
  let started = Date.now();

  function transform(line) {
    total++;
    const key = normalize ? normalizeLine(line) : line;
    counts.set(key, (counts.get(key) || 0) + 1);
    return line;
  }

  function snapshot() {
    return {
      total,
      unique: counts.size,
      elapsed: (Date.now() - started) / 1000,
      top: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN),
    };
  }

  function report(stderr = process.stderr) {
    const s = snapshot();
    if (s.total === 0) {
      stderr.write('wintail summary: 0 lines\n');
      return;
    }
    stderr.write(`\nwintail summary: ${s.total} lines · ${s.unique} unique patterns · ${s.elapsed.toFixed(1)}s\n`);
    stderr.write(`Top ${Math.min(topN, s.top.length)} patterns:\n`);
    for (const [pat, n] of s.top) {
      const pct = ((n / s.total) * 100).toFixed(1);
      const display = pat.length > 110 ? pat.slice(0, 107) + '...' : pat;
      stderr.write(`  ${String(n).padStart(6)} (${pct.padStart(5)}%)  ${display}\n`);
    }
  }

  return { transform, snapshot, report, normalizeLine };
}

module.exports = { createSummary, normalizeLine };
