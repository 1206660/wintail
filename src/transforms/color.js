'use strict';

const ESC = '\x1b';
const RESET = `${ESC}[0m`;

const CODES = {
  reset: '0',
  bold: '1',
  dim: '2',
  underline: '4',
  black: '30', red: '31', green: '32', yellow: '33',
  blue: '34', magenta: '35', cyan: '36', white: '37',
  brightBlack: '90', brightRed: '91', brightGreen: '92', brightYellow: '93',
  brightBlue: '94', brightMagenta: '95', brightCyan: '96', brightWhite: '97',
};

function makeWrap(enabled) {
  if (!enabled) return (s, _code) => s;
  return (s, codeStr) => `${ESC}[${codeStr}m${s}${RESET}`;
}

function parseColorSpec(spec) {
  // 'red', 'red bold', 'bold red', 'magenta dim'
  const parts = String(spec).trim().toLowerCase().split(/\s+/).filter(Boolean);
  const codes = [];
  for (const part of parts) {
    if (CODES[part]) codes.push(CODES[part]);
    else throw new Error(`unknown color/style: ${part}`);
  }
  if (codes.length === 0) throw new Error('empty color spec');
  return codes.join(';');
}

function resolveColorMode(opts, stdout = process.stdout) {
  // mode: 'auto' | 'always' | 'never'
  const mode = opts && opts.color ? opts.color : 'auto';
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  if (process.env.NO_COLOR) return false;
  return Boolean(stdout && stdout.isTTY);
}

module.exports = { ESC, RESET, CODES, makeWrap, parseColorSpec, resolveColorMode };
