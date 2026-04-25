'use strict';

const BOM_UTF8 = Buffer.from([0xEF, 0xBB, 0xBF]);
const BOM_UTF16LE = Buffer.from([0xFF, 0xFE]);
const BOM_UTF16BE = Buffer.from([0xFE, 0xFF]);

function detectBom(buf) {
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return { encoding: 'utf8', length: 3 };
  }
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
    return { encoding: 'utf16le', length: 2 };
  }
  if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
    return { encoding: 'utf16be', length: 2 };
  }
  return { encoding: null, length: 0 };
}

function decodeChunk(buf, encoding) {
  if (encoding === 'utf16le') return buf.toString('utf16le');
  if (encoding === 'utf16be') {
    const swapped = Buffer.allocUnsafe(buf.length & ~1);
    for (let i = 0; i + 1 < buf.length; i += 2) {
      swapped[i] = buf[i + 1];
      swapped[i + 1] = buf[i];
    }
    return swapped.toString('utf16le');
  }
  if (encoding === 'latin1') return buf.toString('latin1');
  if (encoding === 'ascii') return buf.toString('ascii');
  return buf.toString('utf8');
}

module.exports = { detectBom, decodeChunk, BOM_UTF8, BOM_UTF16LE, BOM_UTF16BE };
