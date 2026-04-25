'use strict';

const { detectBom, decodeChunk } = require('./encoding.js');

function takeLastNLinesFromBuffer(buf, count) {
  if (count <= 0 || buf.length === 0) return Buffer.alloc(0);
  const trailingLF = buf[buf.length - 1] === 0x0A;
  const target = count + (trailingLF ? 1 : 0);
  let seen = 0;
  for (let i = buf.length - 1; i >= 0; i--) {
    if (buf[i] === 0x0A) {
      seen++;
      if (seen === target) return buf.subarray(i + 1);
    }
  }
  return buf;
}

function skipFirstNLinesFromBuffer(buf, skip) {
  if (skip <= 0) return buf;
  let seen = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0A) {
      seen++;
      if (seen === skip) return buf.subarray(i + 1);
    }
  }
  return Buffer.alloc(0);
}

function computeTailFromBuffer(buf, opts) {
  if (opts.bytes) {
    if (opts.bytes.from === 'end') {
      const start = Math.max(0, buf.length - opts.bytes.count);
      return buf.subarray(start);
    }
    const start = Math.max(0, opts.bytes.count - 1);
    return start >= buf.length ? Buffer.alloc(0) : buf.subarray(start);
  }
  const count = opts.lines.count;
  if (opts.lines.from === 'end') return takeLastNLinesFromBuffer(buf, count);
  return skipFirstNLinesFromBuffer(buf, count - 1);
}

function stripBomFromBuffer(buf, opts) {
  const bom = detectBom(buf);
  if (!bom.encoding) return { buf, encoding: opts.encoding };
  return { buf: buf.subarray(bom.length), encoding: bom.encoding };
}

function readStdinTail(opts, stdin, pipelineOrStdout, sourceName = 'standard input') {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalLen = 0;
    stdin.on('data', (chunk) => {
      const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(b);
      totalLen += b.length;
    });
    stdin.on('end', () => {
      try {
        let all = Buffer.concat(chunks, totalLen);
        const stripped = stripBomFromBuffer(all, opts);
        all = stripped.buf;
        const useEncoding = stripped.encoding;

        let outBuf;
        if (useEncoding === 'utf16le' || useEncoding === 'utf16be') {
          const text = decodeChunk(all, useEncoding);
          const asUtf8 = Buffer.from(text, 'utf8');
          outBuf = computeTailFromBuffer(asUtf8, opts);
        } else {
          outBuf = computeTailFromBuffer(all, opts);
        }
        // Detect pipeline (has writeChunk) vs raw stream
        if (typeof pipelineOrStdout.writeChunk === 'function') {
          pipelineOrStdout.writeChunk(outBuf, sourceName);
          resolve();
        } else {
          pipelineOrStdout.write(outBuf, resolve);
        }
      } catch (err) { reject(err); }
    });
    stdin.on('error', reject);
  });
}

module.exports = {
  readStdinTail,
  takeLastNLinesFromBuffer,
  skipFirstNLinesFromBuffer,
  computeTailFromBuffer,
};
