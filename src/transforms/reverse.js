'use strict';

// Reverse the line order in a buffer (preserving line content + EOLs).
function reverseBuffer(buf) {
  if (!buf || buf.length === 0) return buf;
  const text = buf.toString('utf8');
  const trailingNewline = text.endsWith('\n');
  const body = trailingNewline ? text.slice(0, -1) : text;
  const lines = body.split('\n');
  const reversed = lines.reverse();
  return Buffer.from(reversed.join('\n') + (trailingNewline ? '\n' : ''));
}

module.exports = { reverseBuffer };
