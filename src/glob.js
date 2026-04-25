'use strict';

const fs = require('node:fs');
const path = require('node:path');

const GLOB_CHARS = /[*?[\]{}]/;
const DEFAULT_DIR_PATTERN = '*.log';

function hasGlob(s) { return GLOB_CHARS.test(s); }

function isFile(p) {
  try { return fs.statSync(p).isFile(); }
  catch { return false; }
}

function isDirectory(p) {
  try { return fs.statSync(p).isDirectory(); }
  catch { return false; }
}

function expandGlob(arg) {
  let matches;
  try { matches = fs.globSync(arg); }
  catch (e) { throw new Error(`'${arg}': ${e.message}`); }
  matches = matches.filter(isFile);
  if (matches.length === 0) {
    throw new Error(`'${arg}': No match`);
  }
  matches.sort((a, b) => a.localeCompare(b));
  return matches;
}

function expandDirectory(dir, pattern) {
  const joined = path.join(dir, pattern);
  let matches;
  try { matches = fs.globSync(joined); }
  catch (e) { throw new Error(`'${dir}': ${e.message}`); }
  matches = matches.filter(isFile);
  if (matches.length === 0) {
    throw new Error(`'${dir}': directory has no files matching ${pattern}`);
  }
  matches.sort((a, b) => a.localeCompare(b));
  return matches;
}

function expand(args, { dirPattern = DEFAULT_DIR_PATTERN } = {}) {
  const out = [];
  for (const arg of args) {
    if (arg === '-') { out.push(arg); continue; }
    if (hasGlob(arg)) {
      out.push(...expandGlob(arg));
      continue;
    }
    if (isDirectory(arg)) {
      out.push(...expandDirectory(arg, dirPattern));
      continue;
    }
    out.push(arg);
  }
  return out;
}

module.exports = { expand, hasGlob, expandGlob, expandDirectory, isDirectory, DEFAULT_DIR_PATTERN };
