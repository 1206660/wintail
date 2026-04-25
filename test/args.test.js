'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, UsageError, parseCount } = require('../src/args.js');

test('default: stdin, last 10 lines', () => {
  const o = parseArgs([]);
  assert.equal(o.mode, 'tail');
  assert.deepEqual(o.files, ['-']);
  assert.deepEqual(o.lines, { from: 'end', count: 10 });
  assert.equal(o.bytes, null);
  assert.equal(o.follow, false);
  assert.equal(o.quiet, false);
  assert.equal(o.verbose, false);
  assert.equal(o.sleepInterval, 1.0);
  assert.equal(o.pid, null);
  assert.equal(o.encoding, 'utf8');
});

test('single file', () => {
  const o = parseArgs(['app.log']);
  assert.deepEqual(o.files, ['app.log']);
  assert.deepEqual(o.lines, { from: 'end', count: 10 });
});

test('multiple files', () => {
  const o = parseArgs(['a.log', 'b.log', 'c.log']);
  assert.deepEqual(o.files, ['a.log', 'b.log', 'c.log']);
});

test('-n N (separate)', () => {
  assert.deepEqual(parseArgs(['-n', '5', 'f']).lines, { from: 'end', count: 5 });
});

test('-n N (attached)', () => {
  assert.deepEqual(parseArgs(['-n5', 'f']).lines, { from: 'end', count: 5 });
});

test('-n +N (from start)', () => {
  assert.deepEqual(parseArgs(['-n', '+5', 'f']).lines, { from: 'start', count: 5 });
});

test('-n -N (explicit minus, same as plain)', () => {
  assert.deepEqual(parseArgs(['-n', '-5', 'f']).lines, { from: 'end', count: 5 });
});

test('--lines=N', () => {
  assert.deepEqual(parseArgs(['--lines=20', 'f']).lines, { from: 'end', count: 20 });
});

test('--lines N', () => {
  assert.deepEqual(parseArgs(['--lines', '20', 'f']).lines, { from: 'end', count: 20 });
});

test('-c N (bytes)', () => {
  const o = parseArgs(['-c', '100', 'f']);
  assert.deepEqual(o.bytes, { from: 'end', count: 100 });
  assert.equal(o.lines, null);
});

test('-c +N from start', () => {
  assert.deepEqual(parseArgs(['-c', '+100', 'f']).bytes, { from: 'start', count: 100 });
});

test('NUM with multiplier suffix', () => {
  assert.deepEqual(parseCount('5k', '-n'), { from: 'end', count: 5 * 1024 });
  assert.deepEqual(parseCount('+2M', '-c'), { from: 'start', count: 2 * 1024 * 1024 });
  assert.deepEqual(parseCount('1G', '-c'), { from: 'end', count: 1024 ** 3 });
  assert.deepEqual(parseCount('3b', '-c'), { from: 'end', count: 3 * 512 });
});

test('-c overrides earlier -n', () => {
  const o = parseArgs(['-n', '5', '-c', '100', 'f']);
  assert.deepEqual(o.bytes, { from: 'end', count: 100 });
  assert.equal(o.lines, null);
});

test('-n overrides earlier -c', () => {
  const o = parseArgs(['-c', '100', '-n', '5', 'f']);
  assert.deepEqual(o.lines, { from: 'end', count: 5 });
  assert.equal(o.bytes, null);
});

test('-f follow descriptor', () => {
  assert.equal(parseArgs(['-f', 'f']).follow, 'descriptor');
});

test('-F follow name', () => {
  assert.equal(parseArgs(['-F', 'f']).follow, 'name');
});

test('--follow=name', () => {
  assert.equal(parseArgs(['--follow=name', 'f']).follow, 'name');
});

test('--follow alone is descriptor', () => {
  assert.equal(parseArgs(['--follow', 'f']).follow, 'descriptor');
});

test('--retry implies follow=name', () => {
  assert.equal(parseArgs(['--retry', 'f']).follow, 'name');
});

test('-F then -f stays name', () => {
  assert.equal(parseArgs(['-F', '-f', 'f']).follow, 'name');
});

test('bundled -fq', () => {
  const o = parseArgs(['-fq', 'f']);
  assert.equal(o.follow, 'descriptor');
  assert.equal(o.quiet, true);
});

test('bundled -qf with -n attached', () => {
  const o = parseArgs(['-qfn5', 'f']);
  assert.equal(o.quiet, true);
  assert.equal(o.follow, 'descriptor');
  assert.deepEqual(o.lines, { from: 'end', count: 5 });
});

test('-q then -v: verbose wins', () => {
  const o = parseArgs(['-q', '-v', 'f']);
  assert.equal(o.verbose, true);
  assert.equal(o.quiet, false);
});

test('-v then -q: quiet wins', () => {
  const o = parseArgs(['-v', '-q', 'f']);
  assert.equal(o.quiet, true);
  assert.equal(o.verbose, false);
});

test('-s 0.5 sleep interval', () => {
  assert.equal(parseArgs(['-s', '0.5', '-f', 'f']).sleepInterval, 0.5);
});

test('--sleep-interval=2', () => {
  assert.equal(parseArgs(['--sleep-interval=2', '-f', 'f']).sleepInterval, 2);
});

test('--pid=1234', () => {
  assert.equal(parseArgs(['--pid=1234', '-f', 'f']).pid, 1234);
});

test('--pid 1234', () => {
  assert.equal(parseArgs(['--pid', '1234', '-f', 'f']).pid, 1234);
});

test('--encoding=utf16le', () => {
  assert.equal(parseArgs(['--encoding=utf16le', 'f']).encoding, 'utf16le');
});

test('--encoding aliases', () => {
  assert.equal(parseArgs(['--encoding=UTF-8', 'f']).encoding, 'utf8');
  assert.equal(parseArgs(['--encoding=UTF-16LE', 'f']).encoding, 'utf16le');
});

test('--help', () => {
  assert.equal(parseArgs(['--help']).mode, 'help');
});

test('-h', () => {
  assert.equal(parseArgs(['-h']).mode, 'help');
});

test('--version', () => {
  assert.equal(parseArgs(['--version']).mode, 'version');
});

test('-V', () => {
  assert.equal(parseArgs(['-V']).mode, 'version');
});

test('--install-alias', () => {
  assert.equal(parseArgs(['--install-alias']).mode, 'install-alias');
});

test('-- terminates flags', () => {
  const o = parseArgs(['--', '-n', 'looks-like-flag']);
  assert.deepEqual(o.files, ['-n', 'looks-like-flag']);
});

test('- is a file (stdin)', () => {
  assert.deepEqual(parseArgs(['-']).files, ['-']);
});

test('mixed file and stdin', () => {
  assert.deepEqual(parseArgs(['a.log', '-', 'b.log']).files, ['a.log', '-', 'b.log']);
});

test('rejects unknown long flag', () => {
  assert.throws(() => parseArgs(['--bogus']), UsageError);
});

test('rejects unknown short flag', () => {
  assert.throws(() => parseArgs(['-Z']), UsageError);
});

test('rejects -n without value', () => {
  assert.throws(() => parseArgs(['-n']), UsageError);
});

test('rejects -n with non-numeric', () => {
  assert.throws(() => parseArgs(['-n', 'abc']), UsageError);
});

test('rejects --pid with non-integer', () => {
  assert.throws(() => parseArgs(['--pid', '1.5']), UsageError);
});

test('rejects --encoding bogus', () => {
  assert.throws(() => parseArgs(['--encoding', 'klingon']), UsageError);
});

test('-n 0 is valid (output nothing)', () => {
  assert.deepEqual(parseArgs(['-n', '0', 'f']).lines, { from: 'end', count: 0 });
});

// ---- v0.2 flags ----

test('default color is auto', () => {
  assert.equal(parseArgs([]).color, 'auto');
});

test('--color=always|never|auto', () => {
  assert.equal(parseArgs(['--color=always']).color, 'always');
  assert.equal(parseArgs(['--color=never']).color, 'never');
  assert.equal(parseArgs(['--color=auto']).color, 'auto');
});

test('--no-color = never', () => {
  assert.equal(parseArgs(['--no-color']).color, 'never');
});

test('--color rejects bogus value', () => {
  assert.throws(() => parseArgs(['--color=neon']), UsageError);
});

test('--highlight collects multiple', () => {
  const o = parseArgs(['--highlight=foo=red', '--highlight=bar=blue', 'f']);
  assert.deepEqual(o.highlights, ['foo=red', 'bar=blue']);
});

test('--no-default-highlight', () => {
  assert.equal(parseArgs(['--no-default-highlight']).noDefaultHighlight, true);
});

test('--grep accumulates', () => {
  const o = parseArgs(['--grep=a', '--grep', 'b', 'f']);
  assert.deepEqual(o.grepPatterns, ['a', 'b']);
});

test('-G short form', () => {
  assert.deepEqual(parseArgs(['-G', 'foo', 'f']).grepPatterns, ['foo']);
  assert.deepEqual(parseArgs(['-Gfoo', 'f']).grepPatterns, ['foo']);
});

test('--grep-v', () => {
  assert.deepEqual(parseArgs(['--grep-v=noise', 'f']).grepVPatterns, ['noise']);
});

test('-N / --line-number', () => {
  assert.equal(parseArgs(['-N', 'f']).lineNumber, true);
  assert.equal(parseArgs(['--line-number', 'f']).lineNumber, true);
});

test('-i / --ignore-case', () => {
  assert.equal(parseArgs(['-i', 'f']).ignoreCase, true);
  assert.equal(parseArgs(['--ignore-case', 'f']).ignoreCase, true);
});

test('--notify-on accumulates', () => {
  const o = parseArgs(['--notify-on=Fatal', '--notify-on', 'panic=Crash', 'f']);
  assert.deepEqual(o.notifyPatterns, ['Fatal', 'panic=Crash']);
});

test('bundled -iN', () => {
  const o = parseArgs(['-iN', 'f']);
  assert.equal(o.ignoreCase, true);
  assert.equal(o.lineNumber, true);
});
