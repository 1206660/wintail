'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Writable } = require('node:stream');
const { createTeeOutput, stripAnsi } = require('../src/multiOut.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wintail-tee-'));
let counter = 0;
function tmpFile() { return path.join(TMP, `o${counter++}.log`); }

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  w.isTTY = false;
  w.columns = 80;
  return w;
}

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test('stripAnsi removes color codes', () => {
  assert.equal(stripAnsi('\x1b[31mred\x1b[0m'), 'red');
  assert.equal(stripAnsi('\x1b[1;31mERROR\x1b[0m: oh'), 'ERROR: oh');
  assert.equal(stripAnsi('plain'), 'plain');
});

test('tee writes to both stdout and file', async () => {
  const stdout = captureStream();
  const filePath = tmpFile();
  const tee = createTeeOutput(stdout, filePath);
  tee.write('hello\n');
  tee.write('world\n');
  await new Promise((r) => tee.end(r));
  assert.equal(stdout.text(), 'hello\nworld\n');
  assert.equal(fs.readFileSync(filePath, 'utf8'), 'hello\nworld\n');
});

test('tee strips ANSI from file by default', async () => {
  const stdout = captureStream();
  const filePath = tmpFile();
  const tee = createTeeOutput(stdout, filePath);
  tee.write('\x1b[31mred\x1b[0m line\n');
  await new Promise((r) => tee.end(r));
  assert.equal(stdout.text(), '\x1b[31mred\x1b[0m line\n');
  assert.equal(fs.readFileSync(filePath, 'utf8'), 'red line\n');
});

test('tee preserves ANSI when stripFile=false', async () => {
  const stdout = captureStream();
  const filePath = tmpFile();
  const tee = createTeeOutput(stdout, filePath, { stripFile: false });
  tee.write('\x1b[31mred\x1b[0m\n');
  await new Promise((r) => tee.end(r));
  assert.equal(fs.readFileSync(filePath, 'utf8'), '\x1b[31mred\x1b[0m\n');
});

test('tee forwards isTTY and columns', () => {
  const stdout = captureStream();
  stdout.isTTY = true;
  stdout.columns = 120;
  const tee = createTeeOutput(stdout, tmpFile());
  assert.equal(tee.isTTY, true);
  assert.equal(tee.columns, 120);
});

test('append mode preserves existing file', async () => {
  const stdout = captureStream();
  const filePath = tmpFile();
  fs.writeFileSync(filePath, 'pre-existing\n');
  const tee = createTeeOutput(stdout, filePath, { append: true });
  tee.write('appended\n');
  await new Promise((r) => tee.end(r));
  assert.equal(fs.readFileSync(filePath, 'utf8'), 'pre-existing\nappended\n');
});
