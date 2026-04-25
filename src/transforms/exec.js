'use strict';

const { spawn } = require('node:child_process');

const DEFAULT_CONCURRENCY = 4;

function defaultRunShell(command, env) {
  return process.platform === 'win32'
    ? spawn('cmd.exe', ['/c', command], { env, stdio: 'ignore', windowsHide: true })
    : spawn('sh', ['-c', command], { env, stdio: 'ignore' });
}

function makeExec({
  command = null,
  maxConcurrent = DEFAULT_CONCURRENCY,
  stderr = process.stderr,
  spawn: spawnFn = defaultRunShell,
} = {}) {
  if (!command) return (line) => line;
  let active = 0;
  let dropped = 0;
  return function exec(line, ctx) {
    if (active >= maxConcurrent) {
      dropped++;
      if (dropped === 1 || dropped % 10 === 0) {
        stderr.write(`wintail: --exec dropped ${dropped} (concurrency cap ${maxConcurrent})\n`);
      }
      return line;
    }
    active++;
    const env = {
      ...process.env,
      WINTAIL_LINE: line,
      WINTAIL_SOURCE: ctx.source || '',
    };
    const expanded = command.includes('{}') ? command.replace(/\{\}/g, line) : command;
    let child;
    try { child = spawnFn(expanded, env); }
    catch (e) {
      active--;
      stderr.write(`wintail: --exec spawn failed: ${e.message}\n`);
      return line;
    }
    if (child) {
      child.on('exit', () => { active--; });
      child.on('error', (e) => { active--; stderr.write(`wintail: --exec error: ${e.message}\n`); });
    } else {
      active--;
    }
    return line;
  };
}

module.exports = { makeExec, DEFAULT_CONCURRENCY };
