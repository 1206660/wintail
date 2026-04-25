'use strict';

const fs = require('node:fs');
const zlib = require('node:zlib');
const { detectBom, decodeChunk } = require('./encoding.js');

const CHUNK_SIZE = 64 * 1024;

function isGzipPath(p) {
  return /\.gz$/i.test(p);
}

function readGzipBuffer(path) {
  const compressed = fs.readFileSync(path);
  return zlib.gunzipSync(compressed);
}

function bufferStripBom(buf, defaultEncoding) {
  const bom = detectBom(buf);
  if (!bom.encoding) return { buf, encoding: defaultEncoding };
  return { buf: buf.subarray(bom.length), encoding: bom.encoding };
}

function takeLastNLinesFromBuf(buf, count) {
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

function skipNLinesFromBuf(buf, skip) {
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

function readGzipPath(path, encoding) {
  const raw = readGzipBuffer(path);
  const stripped = bufferStripBom(raw, encoding);
  let buf = stripped.buf;
  if (stripped.encoding === 'utf16le' || stripped.encoding === 'utf16be') {
    buf = Buffer.from(decodeChunk(buf, stripped.encoding), 'utf8');
  }
  return buf;
}

function openRead(path) {
  return fs.openSync(path, 'r');
}

function fileSizeOf(fd) {
  return fs.fstatSync(fd).size;
}

function probeBom(fd) {
  const head = Buffer.alloc(3);
  const bytesRead = fs.readSync(fd, head, 0, 3, 0);
  return detectBom(head.subarray(0, bytesRead));
}

function readBytes(fd, length, offset) {
  const buf = Buffer.alloc(length);
  let total = 0;
  while (total < length) {
    const n = fs.readSync(fd, buf, total, length - total, offset + total);
    if (n === 0) break;
    total += n;
  }
  return total === length ? buf : buf.subarray(0, total);
}

function splitKeepEol(text) {
  const out = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0x0A) {
      out.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

function endsWithLF(fd, fileSize) {
  if (fileSize === 0) return false;
  const b = Buffer.alloc(1);
  fs.readSync(fd, b, 0, 1, fileSize - 1);
  return b[0] === 0x0A;
}

function readLastLines(path, count, encoding) {
  if (count <= 0) return Buffer.alloc(0);
  if (isGzipPath(path)) {
    return takeLastNLinesFromBuf(readGzipPath(path, encoding), count);
  }
  const fd = openRead(path);
  try {
    const fileSize = fileSizeOf(fd);
    if (fileSize === 0) return Buffer.alloc(0);

    const bom = probeBom(fd);
    const contentStart = bom.length;
    const useEncoding = bom.encoding || encoding;

    if (fileSize <= contentStart) return Buffer.alloc(0);

    if (useEncoding === 'utf16le' || useEncoding === 'utf16be') {
      const buf = readBytes(fd, fileSize - contentStart, contentStart);
      const text = decodeChunk(buf, useEncoding);
      const lines = splitKeepEol(text);
      const tail = lines.slice(Math.max(0, lines.length - count));
      return Buffer.from(tail.join(''), 'utf8');
    }

    const trailingLF = endsWithLF(fd, fileSize);
    const targetNewlines = count + (trailingLF ? 1 : 0);

    let pos = fileSize;
    let totalNewlines = 0;
    const chunks = [];
    let totalLength = 0;

    while (pos > contentStart) {
      const readSize = Math.min(CHUNK_SIZE, pos - contentStart);
      pos -= readSize;
      const chunk = readBytes(fd, readSize, pos);

      let chunkNewlines = 0;
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === 0x0A) chunkNewlines++;
      }

      if (totalNewlines + chunkNewlines >= targetNewlines) {
        let needed = targetNewlines - totalNewlines;
        let cutInChunk = -1;
        for (let i = chunk.length - 1; i >= 0; i--) {
          if (chunk[i] === 0x0A) {
            needed--;
            if (needed === 0) { cutInChunk = i; break; }
          }
        }
        const tailOfChunk = chunk.subarray(cutInChunk + 1);
        chunks.unshift(tailOfChunk);
        totalLength += tailOfChunk.length;
        return Buffer.concat(chunks, totalLength);
      }

      chunks.unshift(chunk);
      totalLength += chunk.length;
      totalNewlines += chunkNewlines;
    }

    return Buffer.concat(chunks, totalLength);
  } finally {
    fs.closeSync(fd);
  }
}

function readFromLine(path, lineNum, encoding) {
  if (isGzipPath(path)) {
    return skipNLinesFromBuf(readGzipPath(path, encoding), Math.max(0, lineNum - 1));
  }
  const fd = openRead(path);
  try {
    const fileSize = fileSizeOf(fd);
    if (fileSize === 0) return Buffer.alloc(0);

    const bom = probeBom(fd);
    const contentStart = bom.length;
    const useEncoding = bom.encoding || encoding;

    if (fileSize <= contentStart) return Buffer.alloc(0);

    if (useEncoding === 'utf16le' || useEncoding === 'utf16be') {
      const buf = readBytes(fd, fileSize - contentStart, contentStart);
      const text = decodeChunk(buf, useEncoding);
      const lines = splitKeepEol(text);
      const startIdx = Math.max(0, lineNum - 1);
      return Buffer.from(lines.slice(startIdx).join(''), 'utf8');
    }

    if (lineNum <= 1) {
      return readBytes(fd, fileSize - contentStart, contentStart);
    }

    let toSkip = lineNum - 1;
    let pos = contentStart;
    while (pos < fileSize && toSkip > 0) {
      const readSize = Math.min(CHUNK_SIZE, fileSize - pos);
      const chunk = readBytes(fd, readSize, pos);
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === 0x0A) {
          toSkip--;
          if (toSkip === 0) {
            const startAbs = pos + i + 1;
            return readBytes(fd, fileSize - startAbs, startAbs);
          }
        }
      }
      pos += chunk.length;
    }
    return Buffer.alloc(0);
  } finally {
    fs.closeSync(fd);
  }
}

function readLastBytes(path, count) {
  if (count <= 0) return Buffer.alloc(0);
  if (isGzipPath(path)) {
    const buf = readGzipBuffer(path);
    const start = Math.max(0, buf.length - count);
    return buf.subarray(start);
  }
  const fd = openRead(path);
  try {
    const fileSize = fileSizeOf(fd);
    if (fileSize === 0) return Buffer.alloc(0);
    const start = Math.max(0, fileSize - count);
    return readBytes(fd, fileSize - start, start);
  } finally {
    fs.closeSync(fd);
  }
}

function readFirstLines(path, count, encoding) {
  if (count <= 0) return Buffer.alloc(0);
  if (isGzipPath(path)) {
    const buf = readGzipPath(path, encoding);
    let seen = 0;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] === 0x0A) {
        seen++;
        if (seen === count) return buf.subarray(0, i + 1);
      }
    }
    return buf;
  }
  const fd = openRead(path);
  try {
    const fileSize = fileSizeOf(fd);
    if (fileSize === 0) return Buffer.alloc(0);
    const bom = probeBom(fd);
    const contentStart = bom.length;
    if (fileSize <= contentStart) return Buffer.alloc(0);

    let pos = contentStart;
    let seen = 0;
    const collected = [];
    while (pos < fileSize && seen < count) {
      const readSize = Math.min(CHUNK_SIZE, fileSize - pos);
      const chunk = readBytes(fd, readSize, pos);
      let cut = -1;
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === 0x0A) {
          seen++;
          if (seen === count) { cut = i; break; }
        }
      }
      if (cut !== -1) {
        collected.push(chunk.subarray(0, cut + 1));
        return Buffer.concat(collected);
      }
      collected.push(chunk);
      pos += chunk.length;
    }
    return Buffer.concat(collected);
  } finally {
    fs.closeSync(fd);
  }
}

function readFromByte(path, byteNum) {
  if (isGzipPath(path)) {
    const buf = readGzipBuffer(path);
    const start = Math.max(0, byteNum - 1);
    return start >= buf.length ? Buffer.alloc(0) : buf.subarray(start);
  }
  const fd = openRead(path);
  try {
    const fileSize = fileSizeOf(fd);
    const start = Math.max(0, byteNum - 1);
    if (start >= fileSize) return Buffer.alloc(0);
    return readBytes(fd, fileSize - start, start);
  } finally {
    fs.closeSync(fd);
  }
}

function initialOffsetForFollow(path, opts) {
  const fd = openRead(path);
  try {
    const fileSize = fileSizeOf(fd);
    return fileSize;
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = {
  readLastLines,
  readFromLine,
  readLastBytes,
  readFromByte,
  readFirstLines,
  initialOffsetForFollow,
  isGzipPath,
};
