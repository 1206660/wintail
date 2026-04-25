'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  readLastLines, readFromLine, readLastBytes, readFromByte,
} = require('../src/readTail.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wintail-test-'));
let counter = 0;

function tmpFile(content, encoding = 'utf8') {
  const p = path.join(TMP, `f${counter++}.txt`);
  if (Buffer.isBuffer(content)) fs.writeFileSync(p, content);
  else fs.writeFileSync(p, content, encoding);
  return p;
}

function asUtf8(buf) { return buf.toString('utf8'); }

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test('readLastLines: simple 3 of 5', () => {
  const p = tmpFile('a\nb\nc\nd\ne\n');
  assert.equal(asUtf8(readLastLines(p, 3, 'utf8')), 'c\nd\ne\n');
});

test('readLastLines: no trailing newline', () => {
  const p = tmpFile('a\nb\nc');
  assert.equal(asUtf8(readLastLines(p, 2, 'utf8')), 'b\nc');
});

test('readLastLines: count > line count', () => {
  const p = tmpFile('a\nb\n');
  assert.equal(asUtf8(readLastLines(p, 100, 'utf8')), 'a\nb\n');
});

test('readLastLines: count = 0', () => {
  const p = tmpFile('a\nb\n');
  assert.equal(asUtf8(readLastLines(p, 0, 'utf8')), '');
});

test('readLastLines: empty file', () => {
  const p = tmpFile('');
  assert.equal(asUtf8(readLastLines(p, 5, 'utf8')), '');
});

test('readLastLines: single line no newline', () => {
  const p = tmpFile('hello');
  assert.equal(asUtf8(readLastLines(p, 1, 'utf8')), 'hello');
  assert.equal(asUtf8(readLastLines(p, 5, 'utf8')), 'hello');
});

test('readLastLines: single newline', () => {
  const p = tmpFile('\n');
  assert.equal(asUtf8(readLastLines(p, 1, 'utf8')), '\n');
});

test('readLastLines: only newlines', () => {
  const p = tmpFile('\n\n\n');
  assert.equal(asUtf8(readLastLines(p, 2, 'utf8')), '\n\n');
});

test('readLastLines: CRLF preserved', () => {
  const p = tmpFile('a\r\nb\r\nc\r\n');
  assert.equal(asUtf8(readLastLines(p, 2, 'utf8')), 'b\r\nc\r\n');
});

test('readLastLines: CRLF mixed with LF', () => {
  const p = tmpFile('a\nb\r\nc\nd\r\n');
  assert.equal(asUtf8(readLastLines(p, 2, 'utf8')), 'c\nd\r\n');
});

test('readLastLines: large file spanning chunks', () => {
  const lines = [];
  for (let i = 0; i < 5000; i++) lines.push(`line-${i}-padding-some-text-here`);
  const p = tmpFile(lines.join('\n') + '\n');
  const got = asUtf8(readLastLines(p, 3, 'utf8')).split('\n').filter(Boolean);
  assert.deepEqual(got, [
    'line-4997-padding-some-text-here',
    'line-4998-padding-some-text-here',
    'line-4999-padding-some-text-here',
  ]);
});

test('readLastLines: very long single line spanning chunks', () => {
  const big = 'x'.repeat(200 * 1024);
  const p = tmpFile(big + '\n');
  assert.equal(asUtf8(readLastLines(p, 1, 'utf8')).length, big.length + 1);
});

test('readLastLines: UTF-8 BOM stripped, content preserved', () => {
  const buf = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('a\nb\nc\n', 'utf8')]);
  const p = tmpFile(buf);
  assert.equal(asUtf8(readLastLines(p, 2, 'utf8')), 'b\nc\n');
});

test('readLastLines: UTF-8 with multibyte chars', () => {
  const p = tmpFile('日本語\n中文\nEnglish\n');
  assert.equal(asUtf8(readLastLines(p, 2, 'utf8')), '中文\nEnglish\n');
});

test('readLastLines: UTF-16LE with BOM', () => {
  const text = 'a\nb\nc\n';
  const buf = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(text, 'utf16le')]);
  const p = tmpFile(buf);
  assert.equal(asUtf8(readLastLines(p, 2, 'utf16le')), 'b\nc\n');
});

test('readFromLine: from line 3 (1-indexed)', () => {
  const p = tmpFile('a\nb\nc\nd\ne\n');
  assert.equal(asUtf8(readFromLine(p, 3, 'utf8')), 'c\nd\ne\n');
});

test('readFromLine: from line 1 = whole file', () => {
  const p = tmpFile('a\nb\nc\n');
  assert.equal(asUtf8(readFromLine(p, 1, 'utf8')), 'a\nb\nc\n');
});

test('readFromLine: past end', () => {
  const p = tmpFile('a\nb\n');
  assert.equal(asUtf8(readFromLine(p, 10, 'utf8')), '');
});

test('readFromLine: empty file', () => {
  const p = tmpFile('');
  assert.equal(asUtf8(readFromLine(p, 1, 'utf8')), '');
});

test('readFromLine: BOM stripped', () => {
  const buf = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('a\nb\nc\n', 'utf8')]);
  const p = tmpFile(buf);
  assert.equal(asUtf8(readFromLine(p, 2, 'utf8')), 'b\nc\n');
});

test('readLastBytes', () => {
  const p = tmpFile('Hello, World!');
  assert.equal(asUtf8(readLastBytes(p, 6)), 'World!');
});

test('readLastBytes: count > size', () => {
  const p = tmpFile('hi');
  assert.equal(asUtf8(readLastBytes(p, 100)), 'hi');
});

test('readLastBytes: empty', () => {
  const p = tmpFile('');
  assert.equal(asUtf8(readLastBytes(p, 100)), '');
});

test('readFromByte: from byte 8 (1-indexed)', () => {
  const p = tmpFile('Hello, World!');
  assert.equal(asUtf8(readFromByte(p, 8)), 'World!');
});

test('readFromByte: from byte 1 = whole file', () => {
  const p = tmpFile('hi');
  assert.equal(asUtf8(readFromByte(p, 1)), 'hi');
});

test('readFromByte: past end', () => {
  const p = tmpFile('hi');
  assert.equal(asUtf8(readFromByte(p, 100)), '');
});

test('readLastLines: .gz auto-decompress', () => {
  const zlib = require('node:zlib');
  const p = path.join(TMP, `f${counter++}.log.gz`);
  const original = 'a\nb\nc\nd\ne\n';
  fs.writeFileSync(p, zlib.gzipSync(Buffer.from(original)));
  assert.equal(asUtf8(readLastLines(p, 2, 'utf8')), 'd\ne\n');
});

test('readLastBytes: .gz', () => {
  const zlib = require('node:zlib');
  const p = path.join(TMP, `f${counter++}.log.gz`);
  fs.writeFileSync(p, zlib.gzipSync(Buffer.from('Hello, World!')));
  assert.equal(asUtf8(readLastBytes(p, 6)), 'World!');
});

test('readFromLine: .gz', () => {
  const zlib = require('node:zlib');
  const p = path.join(TMP, `f${counter++}.log.gz`);
  fs.writeFileSync(p, zlib.gzipSync(Buffer.from('a\nb\nc\nd\n')));
  assert.equal(asUtf8(readFromLine(p, 3, 'utf8')), 'c\nd\n');
});
