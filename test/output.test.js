'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { createPipeline } = require('../src/output.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('passthrough: no transforms, single line', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [], stdout });
  p.writeChunk('hello\n', 'a');
  assert.equal(stdout.text(), 'hello\n');
});

test('passthrough: multiple lines in one chunk', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [], stdout });
  p.writeChunk('a\nb\nc\n', 's');
  assert.equal(stdout.text(), 'a\nb\nc\n');
});

test('partial line carried until newline arrives', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [], stdout });
  p.writeChunk('hel', 's');
  assert.equal(stdout.text(), '');
  p.writeChunk('lo\n', 's');
  assert.equal(stdout.text(), 'hello\n');
});

test('carry stitches across many chunks', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [], stdout });
  for (const c of ['a', 'b', 'c', '\n', 'd', '\n']) p.writeChunk(c, 's');
  assert.equal(stdout.text(), 'abc\nd\n');
});

test('CRLF preserved', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [], stdout });
  p.writeChunk('one\r\ntwo\r\n', 's');
  assert.equal(stdout.text(), 'one\r\ntwo\r\n');
});

test('flush emits trailing partial line without EOL', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [], stdout });
  p.writeChunk('partial', 's');
  assert.equal(stdout.text(), '');
  p.flush();
  assert.equal(stdout.text(), 'partial');
});

test('per-source carry: concurrent sources do not mix', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [], stdout });
  p.writeChunk('a-frag', 'A');
  p.writeChunk('b-frag', 'B');
  p.writeChunk('-end\n', 'A');
  p.writeChunk('-end\n', 'B');
  assert.equal(stdout.text(), 'a-frag-end\nb-frag-end\n');
});

test('transform that returns null drops the line', () => {
  const stdout = captureStream();
  const dropFoo = (line) => line.includes('foo') ? null : line;
  const p = createPipeline({ transforms: [dropFoo], stdout });
  p.writeChunk('keep1\nfoo-drop\nkeep2\n', 's');
  assert.equal(stdout.text(), 'keep1\nkeep2\n');
});

test('transforms apply in order', () => {
  const stdout = captureStream();
  const upper = (line) => line.toUpperCase();
  const exclaim = (line) => line + '!';
  const p = createPipeline({ transforms: [upper, exclaim], stdout });
  p.writeChunk('hi\n', 's');
  assert.equal(stdout.text(), 'HI!\n');
});

test('transform receives content without EOL; EOL preserved on output', () => {
  const stdout = captureStream();
  let observed = null;
  const probe = (line) => { observed = line; return line; };
  const p = createPipeline({ transforms: [probe], stdout });
  p.writeChunk('x\r\n', 's');
  assert.equal(observed, 'x');
  assert.equal(stdout.text(), 'x\r\n');
});

test('transforms can use per-source state', () => {
  const stdout = captureStream();
  const counter = (line, ctx) => {
    const s = ctx.getState('count', () => ({ n: 0 }));
    s.n++;
    return `${ctx.source}#${s.n} ${line}`;
  };
  const p = createPipeline({ transforms: [counter], stdout });
  p.writeChunk('a\nb\n', 'src1');
  p.writeChunk('x\n', 'src2');
  assert.equal(stdout.text(), 'src1#1 a\nsrc1#2 b\nsrc2#1 x\n');
});

test('empty chunk is no-op', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [], stdout });
  p.writeChunk('', 's');
  p.writeChunk(Buffer.alloc(0), 's');
  assert.equal(stdout.text(), '');
});

test('Buffer input decoded as utf8', () => {
  const stdout = captureStream();
  const p = createPipeline({ transforms: [], stdout });
  p.writeChunk(Buffer.from('日本語\n', 'utf8'), 's');
  assert.equal(stdout.text(), '日本語\n');
});

test('flush applies transforms to partial line', () => {
  const stdout = captureStream();
  const upper = (line) => line.toUpperCase();
  const p = createPipeline({ transforms: [upper], stdout });
  p.writeChunk('partial', 's');
  p.flush();
  assert.equal(stdout.text(), 'PARTIAL');
});
