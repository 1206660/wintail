'use strict';

const http = require('node:http');

const ANSI_RE = /\x1b\[([0-9;]*)m/g;

const ANSI_TO_CLASS = {
  '0': null,    '': null,
  '1': 'a-bold','2': 'a-dim',
  '31': 'a-red',  '91': 'a-red',
  '32': 'a-green','92': 'a-green',
  '33': 'a-yellow','93': 'a-yellow',
  '34': 'a-blue', '94': 'a-blue',
  '35': 'a-magenta','95': 'a-magenta',
  '36': 'a-cyan', '96': 'a-cyan',
  '37': null,     '97': null,
  '1;31': 'a-red-b','1;33': 'a-yellow-b','1;35': 'a-magenta-b',
  '31;1': 'a-red-b','33;1': 'a-yellow-b','35;1': 'a-magenta-b',
};

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function ansiToHtml(s) {
  let html = '';
  let openSpans = 0;
  let lastIdx = 0;
  let m;
  ANSI_RE.lastIndex = 0;
  while ((m = ANSI_RE.exec(s)) !== null) {
    html += escapeHtml(s.slice(lastIdx, m.index));
    const code = m[1];
    if (code === '0' || code === '') {
      while (openSpans > 0) { html += '</span>'; openSpans--; }
    } else {
      const cls = ANSI_TO_CLASS[code];
      if (cls) { html += `<span class="${cls}">`; openSpans++; }
    }
    lastIdx = ANSI_RE.lastIndex;
  }
  html += escapeHtml(s.slice(lastIdx));
  while (openSpans > 0) { html += '</span>'; openSpans--; }
  return html;
}

function validatePort(port, spec) {
  if (!Number.isFinite(port) || port < 0 || port > 65535) {
    throw new Error(`--web: invalid port in ${spec}`);
  }
}

function parseBindSpec(spec) {
  if (typeof spec !== 'string' || spec.length === 0) {
    throw new Error('--web: empty bind spec');
  }
  if (/^\d+$/.test(spec)) {
    const port = parseInt(spec, 10);
    validatePort(port, spec);
    return { host: '127.0.0.1', port };
  }
  if (spec.startsWith(':')) {
    const port = parseInt(spec.slice(1), 10);
    validatePort(port, spec);
    return { host: '127.0.0.1', port };
  }
  const idx = spec.lastIndexOf(':');
  if (idx === -1) throw new Error(`--web: invalid spec ${spec} (expected HOST:PORT or :PORT)`);
  const host = spec.slice(0, idx);
  const port = parseInt(spec.slice(idx + 1), 10);
  validatePort(port, spec);
  return { host, port };
}

function isLoopback(host) {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '0.0.0.0' && false;
}

const PAGE_CSS = `
body{margin:0;background:#0c0c0c;color:#cccccc;font-family:'Cascadia Code',Consolas,monospace;font-size:13.5px;line-height:1.55}
header{background:#2d2d30;padding:8px 14px;display:flex;gap:12px;align-items:center;border-bottom:1px solid #1f1f1f;position:sticky;top:0;z-index:10}
header h1{margin:0;font-size:14px;font-weight:600;color:#e6e6e6}
header input[type=text]{background:#1e1e1e;color:#cccccc;border:1px solid #3e3e42;padding:4px 8px;font:inherit;border-radius:3px;width:200px}
header label{font-size:12px;color:#999;display:flex;align-items:center;gap:4px}
header button{background:#3e3e42;color:#e6e6e6;border:none;padding:4px 12px;cursor:pointer;border-radius:3px;font:inherit}
header button:hover{background:#4e4e52}
.status{margin-left:auto;font-size:12px;color:#999}
.status.connected{color:#6a9955}.status.disconnected{color:#f47171}
#log{padding:10px 14px;white-space:pre;font-variant-ligatures:none}
#log div{min-height:1em}
.a-red{color:#f47171}.a-red-b{color:#f47171;font-weight:700}
.a-yellow{color:#f5d76e}.a-yellow-b{color:#f5d76e;font-weight:700}
.a-cyan{color:#4ec9b0}.a-magenta{color:#c586c0}.a-magenta-b{color:#c586c0;font-weight:700}
.a-blue{color:#569cd6}.a-green{color:#6a9955}.a-dim{color:#6c6c6c}.a-bold{font-weight:700}
`.trim();

const PAGE_JS = `
(function(){
  var url = new URL(window.location.href);
  var token = url.searchParams.get('token') || '';
  var src = new EventSource('/events' + (token ? '?token=' + encodeURIComponent(token) : ''));
  var log = document.getElementById('log');
  var status = document.getElementById('status');
  var filter = document.getElementById('filter');
  var auto = document.getElementById('autoscroll');
  var pauseBtn = document.getElementById('pause');
  var clearBtn = document.getElementById('clear');
  var paused = false;
  var bufWhilePaused = [];
  src.onopen = function(){ status.className='status connected'; status.textContent='connected'; };
  src.onerror = function(){ status.className='status disconnected'; status.textContent='disconnected'; };
  src.onmessage = function(e){
    if (paused) { bufWhilePaused.push(e.data); if (bufWhilePaused.length>5000) bufWhilePaused.shift(); return; }
    appendLine(e.data);
  };
  function appendLine(html) {
    var f = filter.value.trim();
    if (f) {
      var tmp = document.createElement('div'); tmp.innerHTML = html;
      try { if (!new RegExp(f, 'i').test(tmp.textContent || '')) return; } catch(_){}
    }
    var div = document.createElement('div');
    div.innerHTML = html;
    log.appendChild(div);
    if (auto.checked) window.scrollTo(0, document.body.scrollHeight);
    while (log.childNodes.length > 5000) log.removeChild(log.firstChild);
  }
  pauseBtn.onclick = function(){
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    if (!paused) { bufWhilePaused.forEach(appendLine); bufWhilePaused = []; }
  };
  clearBtn.onclick = function(){ log.innerHTML = ''; };
})();
`.trim();

function htmlPage(title) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)} · wintail</title>
<style>${PAGE_CSS}</style></head>
<body>
<header>
  <h1>wintail · ${escapeHtml(title)}</h1>
  <label><input type="text" id="filter" placeholder="filter regex (browser-side)"></label>
  <label><input type="checkbox" id="autoscroll" checked> autoscroll</label>
  <button id="pause">Pause</button>
  <button id="clear">Clear</button>
  <span class="status disconnected" id="status">connecting…</span>
</header>
<div id="log"></div>
<script>${PAGE_JS}</script>
</body></html>`;
}

function createWebServer({ bind, token = null, title = 'live tail', stderr = process.stderr } = {}) {
  let host, port;
  try {
    ({ host, port } = parseBindSpec(bind));
    if (!isLoopback(host) && !token) {
      throw new Error(`--web bind ${host}:${port} requires --web-token for non-loopback addresses`);
    }
  } catch (e) {
    return Promise.reject(e);
  }

  const subscribers = new Set();
  let lineCount = 0;

  function broadcast(html) {
    lineCount++;
    const data = `data: ${html.replace(/\n/g, '\ndata: ')}\n\n`;
    for (const res of subscribers) {
      try { res.write(data); }
      catch { subscribers.delete(res); }
    }
  }

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (token !== null) {
      const provided = u.searchParams.get('token');
      if (provided !== token) {
        res.writeHead(403, { 'content-type': 'text/plain' });
        res.end('Forbidden\n');
        return;
      }
    }
    if (u.pathname === '/' || u.pathname === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(htmlPage(title));
      return;
    }
    if (u.pathname === '/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'connection': 'keep-alive',
        'x-accel-buffering': 'no',
      });
      res.write(': connected\n\n');
      subscribers.add(res);
      req.on('close', () => subscribers.delete(res));
      req.on('error', () => subscribers.delete(res));
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not Found\n');
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      const actualPort = server.address().port;
      const url = `http://${host}:${actualPort}/${token ? '?token=' + encodeURIComponent(token) : ''}`;
      stderr.write(`wintail: web server listening at ${url}\n`);
      resolve({
        url, host, port: actualPort,
        broadcast,
        getStats: () => ({ subscribers: subscribers.size, lines: lineCount }),
        stop: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

function makeWebTee(stdout, webServer) {
  return {
    write(chunk, cb) {
      stdout.write(chunk);
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      const lines = text.split('\n');
      const lastIdx = lines.length - 1;
      for (let i = 0; i < lastIdx; i++) {
        webServer.broadcast(ansiToHtml(lines[i]));
      }
      if (lines[lastIdx] !== '') {
        webServer.broadcast(ansiToHtml(lines[lastIdx]));
      }
      if (cb) cb();
    },
    end(cb) { if (cb) cb(); },
    get isTTY() { return stdout.isTTY; },
    get columns() { return stdout.columns; },
  };
}

module.exports = { createWebServer, makeWebTee, ansiToHtml, parseBindSpec, isLoopback, htmlPage };
