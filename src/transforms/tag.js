'use strict';

const { makeWrap } = require('./color.js');

const TAG_PALETTE = ['36;1', '35;1', '33;1', '34;1', '95;1', '92;1', '93;1', '96;1', '94;1', '91;1'];

function hashLabel(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function colorForLabel(label) {
  return TAG_PALETTE[hashLabel(label) % TAG_PALETTE.length];
}

function parseSpec(spec) {
  if (typeof spec !== 'string' || spec.length === 0) {
    throw new Error('--tag: empty spec');
  }
  const eq = spec.lastIndexOf('=');
  if (eq === -1) throw new Error(`--tag needs PATTERN=LABEL: ${spec}`);
  const pattern = spec.slice(0, eq);
  const label = spec.slice(eq + 1);
  if (!pattern) throw new Error(`--tag empty pattern: ${spec}`);
  if (!label)   throw new Error(`--tag empty label: ${spec}`);
  let regex;
  try { regex = new RegExp(pattern); }
  catch (e) { throw new Error(`--tag invalid regex '${pattern}': ${e.message}`); }
  return { regex, label, code: colorForLabel(label) };
}

function makeTagger({ specs = [], enabled = true, color = false } = {}) {
  if (!enabled || !specs || specs.length === 0) return (line) => line;
  const compiled = specs.map(parseSpec);
  const wrap = makeWrap(color);
  return function tag(line) {
    const matched = [];
    for (const c of compiled) if (c.regex.test(line)) matched.push(c);
    if (matched.length === 0) return line;
    const tags = matched.map(c => wrap(`[${c.label}]`, c.code)).join(' ');
    return `${tags} ${line}`;
  };
}

module.exports = { makeTagger, parseSpec, colorForLabel, TAG_PALETTE };
