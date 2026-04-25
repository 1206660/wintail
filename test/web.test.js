'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Writable } = require('node:stream');
const {
  createWebServer, makeWebTee, ansiToHtml, parseBindSpec, isLoopback, htmlPage,
} = require('../src/web.js');

function captureStream() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  w.text = () => Buffer.concat(chunks).toString('utf8');
  return w;
}

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8'), headers: res.headers }));
    }).on('error', reject);
  });
}

test('parseBindSpec: port-only', () => {
  assert.deepEqual(parseBindSpec('8080'), { host: '127.0.0.1', port: 8080 });
});

test('parseBindSpec: :PORT', () => {
  assert.deepEqual(parseBindSpec(':9000'), { host: '127.0.0.1', port: 9000 });
});

test('parseBindSpec: HOST:PORT', () => {
  assert.deepEqual(parseBindSpec('0.0.0.0:8080'), { host: '0.0.0.0', port: 8080 });
});

test('parseBindSpec: rejects invalid', () => {
  assert.throws(() => parseBindSpec(''), /empty/);
  assert.throws(() => parseBindSpec('abc'), /invalid spec/);
  assert.throws(() => parseBindSpec(':99999'), /invalid port/);
});

test('isLoopback', () => {
  assert.equal(isLoopback('127.0.0.1'), true);
  assert.equal(isLoopback('localhost'), true);
  assert.equal(isLoopback('::1'), true);
  assert.equal(isLoopback('0.0.0.0'), false);
  assert.equal(isLoopback('192.168.1.50'), false);
});

test('ansiToHtml: plain text', () => {
  assert.equal(ansiToHtml('hello world'), 'hello world');
});

test('ansiToHtml: escapes HTML special chars', () => {
  assert.equal(ansiToHtml('<script>&'), '&lt;script&gt;&amp;');
});

test('ansiToHtml: red text', () => {
  assert.equal(ansiToHtml('\x1b[31mboom\x1b[0m'), '<span class="a-red">boom</span>');
});

test('ansiToHtml: bold red text', () => {
  assert.equal(ansiToHtml('\x1b[1;31mERROR\x1b[0m'), '<span class="a-red-b">ERROR</span>');
});

test('ansiToHtml: nested then reset', () => {
  const out = ansiToHtml('\x1b[33mwarn \x1b[2mdim\x1b[0m');
  assert.match(out, /a-yellow/);
  assert.match(out, /a-dim/);
});

test('ansiToHtml: unknown code is dropped', () => {
  assert.equal(ansiToHtml('\x1b[999mnope\x1b[0m'), 'nope');
});

test('htmlPage contains title and SSE script', () => {
  const p = htmlPage('app.log');
  assert.match(p, /app\.log/);
  assert.match(p, /EventSource/);
  assert.match(p, /id="filter"/);
  assert.match(p, /id="autoscroll"/);
});

test('createWebServer: refuses non-loopback without token', async () => {
  await assert.rejects(
    () => createWebServer({ bind: '0.0.0.0:0' }),
    /requires --web-token/,
  );
});

test('createWebServer: serves HTML page on /', async () => {
  const stderr = captureStream();
  const srv = await createWebServer({ bind: ':0', stderr });
  try {
    const res = await get(srv.url);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.body, /wintail · live tail/);
  } finally {
    await srv.stop();
  }
});

test('createWebServer: rejects 404 for unknown path', async () => {
  const srv = await createWebServer({ bind: ':0', stderr: captureStream() });
  try {
    const res = await get(srv.url + 'nope');
    assert.equal(res.status, 404);
  } finally {
    await srv.stop();
  }
});

test('createWebServer: token enforced when set', async () => {
  const srv = await createWebServer({ bind: '127.0.0.1:0', token: 'sekrit', stderr: captureStream() });
  try {
    const noToken = await get(`http://${srv.host}:${srv.port}/`);
    assert.equal(noToken.status, 403);
    const withToken = await get(`http://${srv.host}:${srv.port}/?token=sekrit`);
    assert.equal(withToken.status, 200);
  } finally {
    await srv.stop();
  }
});

test('makeWebTee: writes to both stdout and broadcasts to subscribers', async () => {
  const broadcasts = [];
  const fakeServer = { broadcast: (s) => broadcasts.push(s) };
  const stdout = captureStream();
  const tee = makeWebTee(stdout, fakeServer);
  tee.write('hello\nworld\n');
  assert.equal(stdout.text(), 'hello\nworld\n');
  assert.deepEqual(broadcasts, ['hello', 'world']);
});

test('makeWebTee: ANSI is converted to HTML before broadcast', () => {
  const broadcasts = [];
  const fakeServer = { broadcast: (s) => broadcasts.push(s) };
  const tee = makeWebTee(captureStream(), fakeServer);
  tee.write('\x1b[31merror\x1b[0m\n');
  assert.equal(broadcasts[0], '<span class="a-red">error</span>');
});

test('SSE end-to-end: broadcast reaches a subscribed client', async () => {
  const srv = await createWebServer({ bind: ':0', stderr: captureStream() });
  try {
    // Subscribe to /events
    const received = [];
    const finished = new Promise((resolve, reject) => {
      const req = http.get(`${srv.url}events`, (res) => {
        assert.equal(res.statusCode, 200);
        assert.match(res.headers['content-type'], /text\/event-stream/);
        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          let i;
          while ((i = buffer.indexOf('\n\n')) !== -1) {
            const event = buffer.slice(0, i);
            buffer = buffer.slice(i + 2);
            const dataLines = event.split('\n').filter(l => l.startsWith('data: '));
            if (dataLines.length > 0) {
              received.push(dataLines.map(l => l.slice(6)).join('\n'));
              if (received.length >= 2) {
                req.destroy();
                resolve();
              }
            }
          }
        });
        res.on('error', reject);
      });
      req.on('error', () => resolve()); // destroy triggers error; resolve anyway
    });
    // Give the subscription a tick to register
    await new Promise(r => setTimeout(r, 50));
    srv.broadcast('hello');
    srv.broadcast('world');
    await finished;
    assert.deepEqual(received, ['hello', 'world']);
  } finally {
    await srv.stop();
  }
});
