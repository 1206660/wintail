'use strict';

function splitLinesKeepEol(text) {
  const out = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0x0A) {
      out.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  return { complete: out, partial: text.slice(start) };
}

function splitContentEol(line) {
  if (line.endsWith('\r\n')) return { content: line.slice(0, -2), eol: '\r\n' };
  if (line.endsWith('\n')) return { content: line.slice(0, -1), eol: '\n' };
  return { content: line, eol: '' };
}

function createPipeline({ transforms = [], stdout = process.stdout } = {}) {
  const carry = new Map();
  const sourceState = new Map();

  function getState(source, key, init) {
    let bucket = sourceState.get(source);
    if (!bucket) { bucket = new Map(); sourceState.set(source, bucket); }
    if (!bucket.has(key)) bucket.set(key, init());
    return bucket.get(key);
  }

  function applyTransforms(content, source) {
    const ctx = { source, getState: (k, init) => getState(source, k, init) };
    let line = content;
    for (const t of transforms) {
      line = t(line, ctx);
      if (line === null) return null;
    }
    return line;
  }

  function writeChunk(chunk, source) {
    if (!chunk || chunk.length === 0) return;
    const text = (carry.get(source) || '') + (typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    const { complete, partial } = splitLinesKeepEol(text);
    carry.set(source, partial);

    if (complete.length === 0) return;

    const out = [];
    for (const raw of complete) {
      const { content, eol } = splitContentEol(raw);
      const transformed = applyTransforms(content, source);
      if (transformed !== null) out.push(transformed + eol);
    }
    if (out.length > 0) stdout.write(out.join(''));
  }

  function flush() {
    for (const [source, text] of carry.entries()) {
      if (text.length === 0) continue;
      const transformed = applyTransforms(text, source);
      if (transformed !== null) stdout.write(transformed);
    }
    carry.clear();
  }

  return { writeChunk, flush };
}

module.exports = { createPipeline, splitLinesKeepEol, splitContentEol };
