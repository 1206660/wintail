'use strict';

// Module-load smoke test. Catches syntax errors / require failures in
// modules that the unit tests don't transitively load (notably src/index.js
// and src/help.js, since most unit tests target leaf modules).

const test = require('node:test');
const assert = require('node:assert/strict');

test('src/index.js loads without error', () => {
  const m = require('../src/index.js');
  assert.equal(typeof m.main, 'function');
});

test('src/help.js loads and exposes HELP_TEXT + VERSION_TEXT', () => {
  const m = require('../src/help.js');
  assert.ok(typeof m.HELP_TEXT === 'string' && m.HELP_TEXT.length > 0);
  assert.ok(typeof m.VERSION_TEXT === 'string' && m.VERSION_TEXT.length > 0);
});

test('bin/wintail.js entrypoint syntax-checks', () => {
  // Just resolve + read; running it would fork a process.
  const fs = require('node:fs');
  const path = require('node:path');
  const code = fs.readFileSync(path.join(__dirname, '..', 'bin', 'wintail.js'), 'utf8');
  assert.match(code, /require\('\.\.\/src\/index\.js'\)/);
  // Verify it parses by trying to wrap in Function (syntax-only check)
  assert.doesNotThrow(() => new Function(code.replace(/^#!.*\n/, '')));
});
