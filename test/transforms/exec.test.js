'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { EventEmitter } = require('node:events');
const { makeExec } = require('../../src/transforms/exec.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

class FakeChild extends EventEmitter {
  finish() { this.emit('exit', 0); }
  fail(err) { this.emit('error', err); }
}

test('empty command is passthrough', () => {
  const e = makeExec({ command: null });
  assert.equal(e('any', { source: 's' }), 'any');
});

test('spawns command with line as $WINTAIL_LINE', () => {
  let lastEnv;
  const child = new FakeChild();
  const e = makeExec({ command: 'echo hi', spawn: (cmd, env) => { lastEnv = env; return child; } });
  e('hello there', { source: 'app.log' });
  assert.equal(lastEnv.WINTAIL_LINE, 'hello there');
  assert.equal(lastEnv.WINTAIL_SOURCE, 'app.log');
  child.finish();
});

test('{} placeholder replaced with line', () => {
  let cmd;
  const child = new FakeChild();
  const e = makeExec({ command: 'curl -d "{}"', spawn: (c, env) => { cmd = c; return child; } });
  e('payload here', { source: 's' });
  assert.equal(cmd, 'curl -d "payload here"');
  child.finish();
});

test('passes line through unchanged regardless of spawn', () => {
  const child = new FakeChild();
  const e = makeExec({ command: 'true', spawn: () => child });
  assert.equal(e('a line', { source: 's' }), 'a line');
  child.finish();
});

test('drops when concurrency cap reached', () => {
  const stderr = captureStream();
  const child1 = new FakeChild();
  const child2 = new FakeChild();
  let calls = 0;
  const e = makeExec({
    command: 'x',
    maxConcurrent: 2,
    stderr,
    spawn: () => {
      calls++;
      return calls === 1 ? child1 : (calls === 2 ? child2 : null);
    },
  });
  e('1', { source: 's' });
  e('2', { source: 's' });
  e('3', { source: 's' });  // should drop (no spawn call)
  e('4', { source: 's' });  // dropped
  assert.equal(calls, 2);
  assert.match(stderr.text(), /dropped 1/);
});

test('cap recovers after a child exits', () => {
  const child1 = new FakeChild();
  const child2 = new FakeChild();
  const child3 = new FakeChild();
  let calls = 0;
  const childs = [child1, child2, child3];
  const e = makeExec({
    command: 'x',
    maxConcurrent: 2,
    spawn: () => childs[calls++],
    stderr: captureStream(),
  });
  e('a', { source: 's' });
  e('b', { source: 's' });
  child1.finish();  // active drops to 1
  e('c', { source: 's' });  // should now spawn
  assert.equal(calls, 3);
});

test('logs spawn-throw to stderr', () => {
  const stderr = captureStream();
  const e = makeExec({
    command: 'x',
    stderr,
    spawn: () => { throw new Error('ENOENT cmd'); },
  });
  e('line', { source: 's' });
  assert.match(stderr.text(), /spawn failed.*ENOENT/);
});
