'use strict';

const fs = require('node:fs');

const GLOB_CHARS = /[*?[\]{}]/;

function hasGlob(s) { return GLOB_CHARS.test(s); }

function isFile(p) {
  try { return fs.statSync(p).isFile(); }
  catch { return false; }
}

function expand(args) {
  const out = [];
  for (const arg of args) {
    if (arg === '-' || !hasGlob(arg)) { out.push(arg); continue; }
    let matches;
    try { matches = fs.globSync(arg); }
    catch (e) { throw new Error(`'${arg}': ${e.message}`); }
    matches = matches.filter(isFile);
    if (matches.length === 0) {
      throw new Error(`'${arg}': No match`);
    }
    matches.sort((a, b) => a.localeCompare(b));
    out.push(...matches);
  }
  return out;
}

module.exports = { expand, hasGlob };
