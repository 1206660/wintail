'use strict';

const { spawnSync } = require('node:child_process');

const MIN_INTERVAL_MS = 100;

function defaultRunShell(command) {
  return process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/c', command], { encoding: 'utf8', windowsHide: true })
    : spawnSync('sh', ['-c', command], { encoding: 'utf8' });
}

function startWatch({
  command,
  intervalSec = 2,
  pipeline,
  sourceName = null,
  stderr = process.stderr,
  runShell = defaultRunShell,
  emitHeader = null,
} = {}) {
  if (typeof command !== 'string' || command.length === 0) {
    throw new Error('--watch: command must be a non-empty string');
  }
  const source = sourceName || `$(${command.length > 60 ? command.slice(0, 57) + '...' : command})`;
  let runs = 0;
  let stopped = false;

  function tick() {
    if (stopped) return;
    runs++;
    let r;
    try { r = runShell(command); }
    catch (e) {
      stderr.write(`wintail: --watch failed: ${e.message}\n`);
      return;
    }
    if (r.error) {
      stderr.write(`wintail: --watch error: ${r.error.message}\n`);
      return;
    }
    if (r.stderr && r.stderr.length > 0) {
      stderr.write(r.stderr.toString());
    }
    if (r.stdout && r.stdout.length > 0) {
      if (emitHeader) emitHeader(source);
      let out = r.stdout.toString();
      if (!out.endsWith('\n')) out += '\n';
      pipeline.writeChunk(out, source);
    }
  }

  tick();
  const intervalMs = Math.max(MIN_INTERVAL_MS, Math.round(intervalSec * 1000));
  const handle = setInterval(tick, intervalMs);
  if (handle.unref) handle.unref();

  return {
    source,
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearInterval(handle);
    },
    getStats: () => ({ runs }),
    _tickForTest: tick,
  };
}

module.exports = { startWatch, defaultRunShell, MIN_INTERVAL_MS };
