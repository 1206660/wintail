'use strict';

const fs = require('node:fs');
const { detectBom, decodeChunk } = require('./encoding.js');

const CHUNK_SIZE = 64 * 1024;

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

function readFromByte(path, byteNum) {
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
  initialOffsetForFollow,
};
