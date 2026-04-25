'use strict';

const fs = require('node:fs');

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function stripAnsi(s) {
  return typeof s === 'string' ? s.replace(ANSI_RE, '') : s;
}

function createTeeOutput(stdout, savePath, { stripFile = true, append = false } = {}) {
  const fileStream = fs.createWriteStream(savePath, {
    flags: append ? 'a' : 'w',
    encoding: 'utf8',
  });
  return {
    write(chunk, cb) {
      stdout.write(chunk);
      const forFile = stripFile && typeof chunk === 'string' ? stripAnsi(chunk) : chunk;
      fileStream.write(forFile);
      if (cb) cb();
    },
    end(cb) { fileStream.end(cb); },
    get isTTY() { return stdout.isTTY; },
    get columns() { return stdout.columns; },
  };
}

module.exports = { createTeeOutput, stripAnsi };
