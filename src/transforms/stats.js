'use strict';

const RE_ERROR = /\b(error|fatal|panic|err)\b/i;
const RE_WARN = /\b(warn(?:ing)?)\b/i;

function createStatsCollector({ intervalSec = 10, stderr = process.stderr, now = () => Date.now() } = {}) {
  const startedAt = now();
  let total = 0;
  let errors = 0;
  let warns = 0;
  const perSource = new Map();
  let lastReportAt = startedAt;
  let lastReportTotal = 0;
  let intervalHandle = null;

  function transform(line, ctx) {
    total++;
    if (RE_ERROR.test(line)) errors++;
    if (RE_WARN.test(line)) warns++;
    const ps = perSource.get(ctx.source) || 0;
    perSource.set(ctx.source, ps + 1);
    return line;
  }

  function snapshot() {
    const t = now();
    const elapsed = (t - lastReportAt) / 1000;
    const rateRecent = elapsed > 0 ? ((total - lastReportTotal) / elapsed) : 0;
    const totalElapsed = (t - startedAt) / 1000;
    const rateAvg = totalElapsed > 0 ? (total / totalElapsed) : 0;
    return { total, errors, warns, rateRecent, rateAvg, perSource: new Map(perSource) };
  }

  function formatLine(s) {
    const top = [...s.perSource.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    return `wintail [stats] lines=${s.total} err=${s.errors} warn=${s.warns} ` +
           `rate=${s.rateRecent.toFixed(1)}/s avg=${s.rateAvg.toFixed(1)}/s` +
           (top ? ` ${top}` : '');
  }

  function report() {
    const s = snapshot();
    stderr.write(formatLine(s) + '\n');
    lastReportAt = now();
    lastReportTotal = s.total;
  }

  function start() {
    if (intervalHandle !== null) return;
    intervalHandle = setInterval(report, intervalSec * 1000);
    if (intervalHandle.unref) intervalHandle.unref();
  }

  function stop() {
    if (intervalHandle !== null) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
    report();
  }

  return { transform, snapshot, formatLine, start, stop, report };
}

module.exports = { createStatsCollector };
