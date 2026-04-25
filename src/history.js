'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const MAX_HISTORY_LINES = 200;

function historyDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'wintail');
  }
  return path.join(os.homedir(), '.wintail');
}

function historyPath() {
  return path.join(historyDir(), 'history.jsonl');
}

function recordInvocation(argv, { skip = false, cwd = process.cwd() } = {}) {
  if (skip || !argv || argv.length === 0) return;
  const entry = { ts: new Date().toISOString(), cwd, args: argv };
  try {
    const dir = historyDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(historyPath(), JSON.stringify(entry) + '\n', 'utf8');
    trimHistory();
  } catch {
    // best-effort; never fail wintail because of history I/O
  }
}

function trimHistory() {
  try {
    const text = fs.readFileSync(historyPath(), 'utf8');
    const lines = text.split('\n').filter(Boolean);
    if (lines.length <= MAX_HISTORY_LINES) return;
    fs.writeFileSync(historyPath(), lines.slice(-MAX_HISTORY_LINES).join('\n') + '\n', 'utf8');
  } catch {}
}

function readHistory() {
  let text;
  try { text = fs.readFileSync(historyPath(), 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const out = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch {}
  }
  return out;
}

function recentUnique(entries, n) {
  const seen = new Set();
  const out = [];
  for (let i = entries.length - 1; i >= 0 && out.length < n; i--) {
    const key = JSON.stringify(entries[i].args);
    if (seen.has(key)) continue;
    seen.add(key);
    out.unshift(entries[i]);  // preserve recency order
  }
  return out;
}

function formatRow(idx, entry) {
  const date = new Date(entry.ts);
  const ts = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')}`;
  const cmd = ['wintail', ...entry.args].join(' ');
  return `  ${String(idx).padStart(2)}) ${ts}  ${cmd}`;
}

function promptInput(stdin = process.stdin) {
  return new Promise((resolve) => {
    let buf = '';
    function onData(chunk) {
      const s = chunk.toString('utf8');
      buf += s;
      const nl = buf.indexOf('\n');
      if (nl !== -1) {
        stdin.removeListener('data', onData);
        resolve(buf.slice(0, nl).replace(/\r$/, ''));
      }
    }
    stdin.on('data', onData);
  });
}

async function pickFromHistory({
  count = 5,
  preselect = null,
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const all = readHistory();
  // Drop the most recent entry if it's the current --resume invocation
  const filtered = all.filter(e => !(e.args.length >= 1 && (e.args[0] === '--resume' || e.args[0].startsWith('--resume='))));
  const recent = recentUnique(filtered, count);
  if (recent.length === 0) {
    stderr.write('wintail: no history yet (run wintail with some args first)\n');
    return null;
  }

  if (preselect !== null) {
    if (preselect < 1 || preselect > recent.length) {
      stderr.write(`wintail: --resume index out of range: ${preselect} (have ${recent.length})\n`);
      return null;
    }
    return recent[preselect - 1];
  }

  stdout.write('Recent wintail commands:\n');
  for (let i = 0; i < recent.length; i++) {
    stdout.write(formatRow(i + 1, recent[i]) + '\n');
  }

  if (!stdin.isTTY) {
    // Non-interactive — just default to most recent (last in list)
    return recent[recent.length - 1];
  }

  stdout.write(`Pick [1-${recent.length}] (Enter = ${recent.length}): `);
  const answer = await promptInput(stdin);
  let pick;
  if (answer.trim() === '') pick = recent.length;
  else {
    pick = parseInt(answer.trim(), 10);
    if (!Number.isFinite(pick) || pick < 1 || pick > recent.length) {
      stderr.write(`wintail: invalid selection: ${answer}\n`);
      return null;
    }
  }
  return recent[pick - 1];
}

function listHistory({ count = 20, stdout = process.stdout } = {}) {
  const all = readHistory();
  if (all.length === 0) {
    stdout.write('(no history yet)\n');
    return;
  }
  const tail = all.slice(-count);
  for (let i = 0; i < tail.length; i++) {
    stdout.write(formatRow(i + 1, tail[i]) + '\n');
  }
}

module.exports = {
  recordInvocation, readHistory, recentUnique, formatRow,
  pickFromHistory, listHistory, historyPath, historyDir,
};
