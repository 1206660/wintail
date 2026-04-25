'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Writable } = require('node:stream');
const { createPipeline } = require('../src/output.js');
const { loadPlugin, loadPlugins } = require('../src/plugin.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wintail-plugin-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

let counter = 0;
function tmpModule(content) {
  const p = path.join(TMP, `p${counter++}.js`);
  fs.writeFileSync(p, content);
  return p;
}

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

test('loadPlugin: function export', () => {
  const p = tmpModule('module.exports = (line) => line.toUpperCase();');
  const fns = loadPlugin(p);
  assert.equal(fns.length, 1);
  assert.equal(fns[0]('hi', { source: 's', getState: () => ({}) }), 'HI');
});

test('loadPlugin: { transform } export', () => {
  const p = tmpModule('module.exports = { transform: (line) => "X:" + line };');
  const fns = loadPlugin(p);
  assert.equal(fns[0]('y', { source: 's', getState: () => ({}) }), 'X:y');
});

test('loadPlugin: array of functions', () => {
  const p = tmpModule('module.exports = [(l) => l + "1", (l) => l + "2"];');
  const fns = loadPlugin(p);
  assert.equal(fns.length, 2);
});

test('loadPlugin: { transforms: [...] }', () => {
  const p = tmpModule('module.exports = { transforms: [(l) => "A" + l, (l) => l + "Z"] };');
  const fns = loadPlugin(p);
  assert.equal(fns.length, 2);
});

test('loadPlugin: rejects non-function exports', () => {
  const p = tmpModule('module.exports = { wat: 1 };');
  assert.throws(() => loadPlugin(p), /must export a function/);
});

test('loadPlugin: rejects array with non-function', () => {
  const p = tmpModule('module.exports = [(l)=>l, "not a fn"];');
  assert.throws(() => loadPlugin(p), /array must contain only functions/);
});

test('loadPlugin: file not found', () => {
  assert.throws(() => loadPlugin('/no/such/file.js'), /cannot load/);
});

test('loadPlugin: syntax error in plugin', () => {
  const p = tmpModule('module.exports = (line) => line.toUpperCase  // missing paren');
  // Note: this is actually valid JS (no call), so just check load works
  assert.doesNotThrow(() => loadPlugin(p));
  // a really broken one:
  const bad = tmpModule('module.exports = ((');
  assert.throws(() => loadPlugin(bad), /cannot load/);
});

test('integration: plugin runs in pipeline', () => {
  const p = tmpModule('module.exports = (line) => "[plugin] " + line;');
  const fns = loadPlugin(p);
  const stdout = captureStream();
  const pipe = createPipeline({ transforms: fns, stdout });
  pipe.writeChunk('hello\n', 's');
  assert.equal(stdout.text(), '[plugin] hello\n');
});

test('integration: stateful plugin via ctx.getState', () => {
  const p = tmpModule(`
    module.exports = (line, ctx) => {
      const s = ctx.getState('myCount', () => ({ n: 0 }));
      s.n++;
      return \`#\${s.n} \${line}\`;
    };
  `);
  const stdout = captureStream();
  const pipe = createPipeline({ transforms: loadPlugin(p), stdout });
  pipe.writeChunk('a\nb\nc\n', 's');
  assert.equal(stdout.text(), '#1 a\n#2 b\n#3 c\n');
});

test('loadPlugins: multiple plugins, order preserved', () => {
  const p1 = tmpModule('module.exports = (l) => l + "[1]";');
  const p2 = tmpModule('module.exports = (l) => l + "[2]";');
  const fns = loadPlugins([p1, p2]);
  const stdout = captureStream();
  const pipe = createPipeline({ transforms: fns, stdout });
  pipe.writeChunk('x\n', 's');
  assert.equal(stdout.text(), 'x[1][2]\n');
});

test('loadPlugins: empty list', () => {
  assert.deepEqual(loadPlugins([]), []);
  assert.deepEqual(loadPlugins(null), []);
});
