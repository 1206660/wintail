'use strict';

const ESC = '\x1b';
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;
const SAVE_CURSOR = `${ESC}7`;
const RESTORE_CURSOR = `${ESC}8`;
const CLEAR_LINE = `${ESC}[2K`;
const RESET_REGION = `${ESC}[r`;

const setScrollRegion = (top, bottom) => `${ESC}[${top};${bottom}r`;
const moveTo = (row, col) => `${ESC}[${row};${col}H`;

function detectSupport(stdout = process.stdout, platform = process.platform) {
  if (!stdout || !stdout.isTTY) return false;
  if (process.env.WINTAIL_NO_TUI === '1') return false;
  if (process.env.WT_SESSION) return true;                        // Windows Terminal
  if (process.env.WEZTERM_EXECUTABLE) return true;
  if (process.env.TERM_PROGRAM) return true;                      // iTerm2 / Apple Terminal / VSCode
  const term = process.env.TERM || '';
  if (term.includes('xterm') || term.includes('color') || term === 'tmux' || term.includes('screen')) return true;
  // Modern Windows console host (Win10 1607+) supports VT escape sequences
  // including DECSTBM scroll region. PowerShell + plain conhost doesn't set
  // any of the env vars above but still works.
  if (platform === 'win32') return true;
  return false;
}

function fmtUptime(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m${String(sec % 60).padStart(2, '0')}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h < 24) return `${h}h${String(m).padStart(2, '0')}m`;
  const d = Math.floor(h / 24);
  return `${d}d${h % 24}h`;
}

function fileLabel(files) {
  if (!files || files.length === 0) return '(no files)';
  if (files.length === 1) {
    const base = files[0].split(/[\\/]/).pop() || files[0];
    return base;
  }
  if (files.length <= 3) {
    return files.map(f => f.split(/[\\/]/).pop()).join(', ');
  }
  return `${files.length} files`;
}

function formatHud({ files = [], total = 0, ratePerSec = 0, errors = 0, warns = 0, startedAt, now = Date.now() }) {
  const f = fileLabel(files);
  const uptime = fmtUptime(now - startedAt);
  const stats = `${total} lines · ${ratePerSec.toFixed(1)}/s`;
  const sev = (errors > 0 || warns > 0) ? ` · err ${errors} warn ${warns}` : '';
  return `wintail · ${f} · ${uptime} · ${stats}${sev}`;
}

function rightAlign(text, width) {
  if (text.length >= width) return text.slice(text.length - width);
  return ' '.repeat(width - text.length) + text;
}

function createTui({ stdout = process.stdout, stderr = process.stderr, force = false } = {}) {
  const supported = force || detectSupport(stdout);
  if (!supported) {
    return { enter: () => {}, repaint: () => {}, exit: () => {}, supported: false };
  }

  let entered = false;
  let cols = stdout.columns || 80;
  let rows = stdout.rows || 24;
  const onResize = () => {
    cols = stdout.columns || 80;
    rows = stdout.rows || 24;
    if (entered) {
      stdout.write(setScrollRegion(3, rows));
    }
  };

  function enter() {
    if (entered) return;
    entered = true;
    stdout.write(
      HIDE_CURSOR +
      setScrollRegion(3, rows) +
      moveTo(rows, 1)
    );
    if (typeof stdout.on === 'function') stdout.on('resize', onResize);
  }

  function repaint(state) {
    if (!entered) return;
    const text = formatHud(state);
    const aligned = rightAlign(text, cols);
    const divider = '─'.repeat(cols);
    stdout.write(
      SAVE_CURSOR +
      moveTo(1, 1) + CLEAR_LINE + `${ESC}[2m` + aligned + `${ESC}[0m` +
      moveTo(2, 1) + CLEAR_LINE + `${ESC}[2m` + divider + `${ESC}[0m` +
      RESTORE_CURSOR
    );
  }

  function exit() {
    if (!entered) return;
    entered = false;
    stdout.write(
      RESET_REGION +
      moveTo(1, 1) + CLEAR_LINE +
      moveTo(2, 1) + CLEAR_LINE +
      moveTo(1, 1) +
      SHOW_CURSOR
    );
    if (typeof stdout.off === 'function') stdout.off('resize', onResize);
  }

  return { enter, repaint, exit, supported: true };
}

module.exports = {
  createTui, formatHud, fmtUptime, fileLabel, rightAlign, detectSupport,
};
