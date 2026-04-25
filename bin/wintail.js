#!/usr/bin/env node
'use strict';
require('../src/index.js').main(process.argv.slice(2)).catch((err) => {
  process.stderr.write(`wintail: ${err.stack || err.message || String(err)}\n`);
  process.exit(1);
});
