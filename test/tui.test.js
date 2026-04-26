'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const {
  createTui, formatHud, fmtUptime, fileLabel, rightAlign, detectSupport,
} = require('../src/tui.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  w.isTTY = true;
  w.columns = 100;
  w.rows = 24;
  return w;
}

test('fmtUptime: under a minute', () => {
  assert.equal(fmtUptime(45 * 1000), '45s');
});

test('fmtUptime: minutes', () => {
  assert.equal(fmtUptime((8 * 60 + 42) * 1000), '8m42s');
});

test('fmtUptime: hours', () => {
  assert.equal(fmtUptime((3 * 3600 + 5 * 60) * 1000), '3h05m');
});

test('fmtUptime: days', () => {
  assert.equal(fmtUptime((2 * 86400 + 3 * 3600) * 1000), '2d3h');
});

test('fileLabel: empty', () => {
  assert.equal(fileLabel([]), '(no files)');
});

test('fileLabel: single file (basename only)', () => {
  assert.equal(fileLabel(['D:\\Project\\Saved\\Logs\\app.log']), 'app.log');
  assert.equal(fileLabel(['/var/log/nginx/access.log']), 'access.log');
});

test('fileLabel: 2-3 files joined', () => {
  assert.equal(fileLabel(['a.log', 'b.log', 'c.log']), 'a.log, b.log, c.log');
});

test('fileLabel: 4+ files truncated to count', () => {
  assert.equal(fileLabel(['a','b','c','d','e']), '5 files');
});

test('rightAlign pads short text', () => {
  assert.equal(rightAlign('hi', 10), '        hi');
});

test('rightAlign truncates long text from left', () => {
  assert.equal(rightAlign('verylongtext', 5), 'gtext');
});

test('formatHud: full HUD line', () => {
  const out = formatHud({
    files: ['app.log'],
    total: 247,
    ratePerSec: 5.2,
    errors: 3,
    warns: 12,
    startedAt: 1000,
    now: 1000 + (8 * 60 + 42) * 1000,
  });
  assert.equal(out, 'wintail · app.log · 8m42s · 247 lines · 5.2/s · err 3 warn 12');
});

test('formatHud: omits severity counts when zero', () => {
  const out = formatHud({
    files: ['x.log'], total: 100, ratePerSec: 1.0,
    errors: 0, warns: 0,
    startedAt: 1000, now: 5000,
  });
  assert.equal(out, 'wintail · x.log · 4s · 100 lines · 1.0/s');
});

test('detectSupport: returns false for non-TTY', () => {
  const fake = { isTTY: false };
  assert.equal(detectSupport(fake), false);
});

test('detectSupport: WINTAIL_NO_TUI=1 disables', () => {
  const orig = process.env.WINTAIL_NO_TUI;
  process.env.WINTAIL_NO_TUI = '1';
  try {
    assert.equal(detectSupport({ isTTY: true }), false);
  } finally {
    if (orig === undefined) delete process.env.WINTAIL_NO_TUI;
    else process.env.WINTAIL_NO_TUI = orig;
  }
});

test('detectSupport: WT_SESSION enables (Windows Terminal)', () => {
  const origWT = process.env.WT_SESSION;
  process.env.WT_SESSION = 'abc-123';
  try {
    assert.equal(detectSupport({ isTTY: true }), true);
  } finally {
    if (origWT === undefined) delete process.env.WT_SESSION;
    else process.env.WT_SESSION = origWT;
  }
});

test('createTui: unsupported returns no-op object', () => {
  const fake = { isTTY: false };
  const tui = createTui({ stdout: fake });
  assert.equal(tui.supported, false);
  // None of the methods should throw
  tui.enter();
  tui.repaint({ files: [], total: 0, ratePerSec: 0, errors: 0, warns: 0, startedAt: Date.now() });
  tui.exit();
});

test('createTui: enter/repaint/exit lifecycle writes expected escapes', () => {
  const stdout = captureStream();
  const tui = createTui({ stdout, force: true });
  assert.equal(tui.supported, true);

  tui.enter();
  let out = stdout.text();
  assert.match(out, /\x1b\[\?25l/);  // hide cursor
  assert.match(out, /\x1b\[3;24r/);  // scroll region rows 3..24

  tui.repaint({
    files: ['app.log'], total: 50, ratePerSec: 2.5,
    errors: 1, warns: 0, startedAt: Date.now() - 5000,
  });
  out = stdout.text();
  assert.match(out, /wintail · app\.log/);
  assert.match(out, /50 lines · 2\.5\/s · err 1 warn 0/);
  assert.match(out, /─{50,}/);  // divider line filled with box-drawing dashes

  tui.exit();
  out = stdout.text();
  assert.match(out, /\x1b\[r/);     // reset scroll region
  assert.match(out, /\x1b\[\?25h/);  // show cursor
});

test('createTui: repaint without enter is no-op', () => {
  const stdout = captureStream();
  const tui = createTui({ stdout, force: true });
  tui.repaint({ files: [], total: 0, ratePerSec: 0, errors: 0, warns: 0, startedAt: Date.now() });
  assert.equal(stdout.text(), '');
});

test('createTui: double-exit safe', () => {
  const stdout = captureStream();
  const tui = createTui({ stdout, force: true });
  tui.enter();
  tui.exit();
  const beforeSecondExit = stdout.text().length;
  tui.exit();  // no-op
  assert.equal(stdout.text().length, beforeSecondExit);
});
