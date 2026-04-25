'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generate, FLAGS, flagsOnly,
  powershellScript, bashScript, zshScript,
} = require('../src/completions.js');

test('FLAGS list includes core GNU tail flags', () => {
  const list = flagsOnly();
  for (const f of ['-n', '-c', '-f', '-F', '-q', '-v', '--help', '--version']) {
    assert.ok(list.includes(f), `missing ${f}`);
  }
});

test('FLAGS list includes wintail extensions', () => {
  const list = flagsOnly();
  for (const f of ['--ue', '--web', '--json-filter', '--resume', '--notify-on', '--collapse-repeats']) {
    assert.ok(list.includes(f), `missing ${f}`);
  }
});

test('PowerShell script registers completer', () => {
  const out = powershellScript();
  assert.match(out, /Register-ArgumentCompleter -Native -CommandName wintail/);
  assert.match(out, /'-n', '-c', '-f', '-F'/);
});

test('bash script defines complete function', () => {
  const out = bashScript();
  assert.match(out, /_wintail_complete\(\)/);
  assert.match(out, /complete -F _wintail_complete wintail/);
  assert.match(out, /--color\)\s+COMPREPLY=\( \$\(compgen -W "auto always never"/);
});

test('bash script offers file completion for path-taking flags', () => {
  const out = bashScript();
  assert.match(out, /--include-from\|--exclude-from\|--save\|--save-append/);
});

test('zsh script uses _arguments + compdef', () => {
  const out = zshScript();
  assert.match(out, /_arguments/);
  assert.match(out, /compdef _wintail wintail/);
  // each flag is a quoted spec
  assert.match(out, /'-n\[/);
});

test('generate dispatches by shell name', () => {
  assert.match(generate('powershell'), /Register-ArgumentCompleter/);
  assert.match(generate('bash'),       /complete -F _wintail_complete/);
  assert.match(generate('zsh'),        /compdef _wintail wintail/);
});

test('generate accepts pwsh and posh aliases', () => {
  assert.match(generate('pwsh'), /Register-ArgumentCompleter/);
  assert.match(generate('posh'), /Register-ArgumentCompleter/);
});

test('generate rejects unknown shell', () => {
  assert.throws(() => generate('fish'), /unsupported shell/);
});

test('FLAGS are unique', () => {
  const set = new Set(flagsOnly());
  assert.equal(set.size, flagsOnly().length);
});
