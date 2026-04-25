'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeUeFormatter, colorForChannel, hashString } = require('../../src/transforms/ue.js');

const ESC = '\x1b';

test('parses UE line: channel + Display severity', () => {
  const f = makeUeFormatter({ enabled: true });
  const out = f('[2024.01.15-10.30.45:123][  0]LogTemp: hello world');
  assert.match(out, /LogTemp/);
  assert.match(out, /hello world/);
  // ts and frame are dim
  assert.match(out, /\x1b\[2m\[2024\.01\.15-10\.30\.45:123\]\x1b\[0m/);
});

test('Error severity wrapped in bold red', () => {
  const f = makeUeFormatter({ enabled: true });
  const out = f('[2024.01.15-10.30.45:123][  0]LogTemp: Error: something broke');
  assert.match(out, /\x1b\[1;31mError\x1b\[0m: something broke/);
});

test('Warning severity wrapped in yellow', () => {
  const f = makeUeFormatter({ enabled: true });
  const out = f('[2024.01.15-10.30.45:123][  0]LogBlueprint: Warning: missing node');
  assert.match(out, /\x1b\[33mWarning\x1b\[0m: missing node/);
});

test('Fatal severity wrapped in bold magenta', () => {
  const f = makeUeFormatter({ enabled: true });
  const out = f('[2024.01.15-10.30.45:123][  0]LogCore: Fatal: assertion failed');
  assert.match(out, /\x1b\[1;35mFatal\x1b\[0m: assertion failed/);
});

test('Verbose severity dimmed', () => {
  const f = makeUeFormatter({ enabled: true });
  const out = f('[2024.01.15-10.30.45:123][  0]LogTemp: Verbose: noisy detail');
  assert.match(out, /\x1b\[2mVerbose\x1b\[0m: noisy detail/);
});

test('non-UE indented line is dimmed (stack continuation)', () => {
  const f = makeUeFormatter({ enabled: true });
  const out = f('    at FrameInfo::Update (file.cpp:42)');
  assert.match(out, /\x1b\[2m    at FrameInfo/);
});

test('non-UE non-indented line passes through unchanged', () => {
  const f = makeUeFormatter({ enabled: true });
  assert.equal(f('Some random output'), 'Some random output');
});

test('disabled (color off) returns plain text', () => {
  const f = makeUeFormatter({ enabled: false });
  const out = f('[2024.01.15-10.30.45:123][  0]LogTemp: Error: boom');
  assert.equal(out, '[2024.01.15-10.30.45:123][  0]LogTemp: Error: boom');
});

test('channel coloring is deterministic', () => {
  assert.equal(colorForChannel('LogTemp'), colorForChannel('LogTemp'));
  // distinct channels likely (not guaranteed) different
  assert.ok(colorForChannel('LogTemp') !== '' && colorForChannel('LogTemp').length > 0);
});

test('hashString stable', () => {
  assert.equal(hashString('LogTemp'), hashString('LogTemp'));
  assert.notEqual(hashString('LogTemp'), hashString('LogRender'));
});

test('frame number with multiple digits', () => {
  const f = makeUeFormatter({ enabled: true });
  const out = f('[2024.01.15-10.30.45:123][12345]LogPlayer: spawned');
  assert.match(out, /LogPlayer/);
  assert.match(out, /spawned/);
});
