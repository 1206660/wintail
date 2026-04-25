'use strict';

const { stripAnsi } = require('../multiOut.js');

const THROTTLE_MS = 5000;

function detectFormat(url) {
  if (/hooks\.slack\.com\//.test(url)) return 'slack';
  if (/discord(?:app)?\.com\/api\/webhooks/.test(url)) return 'discord';
  return 'generic';
}

function buildPayload(format, source, line, now = new Date()) {
  const clean = stripAnsi(line);
  if (format === 'slack') {
    return { text: `wintail · ${source}\n\`\`\`\n${clean}\n\`\`\`` };
  }
  if (format === 'discord') {
    return { content: `**wintail · ${source}**\n\`\`\`\n${clean}\n\`\`\`` };
  }
  return { source, line: clean, timestamp: now.toISOString() };
}

function parseSpec(spec) {
  if (typeof spec !== 'string' || spec.length === 0) {
    throw new Error('--webhook: empty spec');
  }
  const eq = spec.lastIndexOf('=');
  if (eq === -1) throw new Error(`--webhook needs PATTERN=URL: ${spec}`);
  const pattern = spec.slice(0, eq);
  const url = spec.slice(eq + 1);
  if (!pattern) throw new Error(`--webhook empty pattern: ${spec}`);
  if (!/^https?:\/\//.test(url)) throw new Error(`--webhook URL must start with http(s)://: ${url}`);
  let regex;
  try { regex = new RegExp(pattern); }
  catch (e) { throw new Error(`--webhook invalid regex '${pattern}': ${e.message}`); }
  return { regex, url, format: detectFormat(url), key: `${pattern}|${url}` };
}

async function defaultPost(url, payload) {
  // Node 18+ ships fetch globally
  try {
    if (typeof fetch === 'function') {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Drain the body so the connection can close cleanly
      try { await res.text(); } catch {}
    }
  } catch {
    // best-effort; never crash wintail because a webhook is down
  }
}

function makeWebhook(specs, deps = {}) {
  if (!specs || specs.length === 0) return (line) => line;
  const post = deps.post || defaultPost;
  const now = deps.now || (() => Date.now());
  const dateNow = deps.dateNow || (() => new Date());
  const compiled = specs.map(parseSpec);
  const lastFired = new Map();
  return function webhook(line, ctx) {
    const t = now();
    for (const c of compiled) {
      if (c.regex.test(line)) {
        const last = lastFired.has(c.key) ? lastFired.get(c.key) : -Infinity;
        if (t - last >= THROTTLE_MS) {
          lastFired.set(c.key, t);
          const payload = buildPayload(c.format, ctx.source, line, dateNow());
          post(c.url, payload);
        }
      }
    }
    return line;
  };
}

module.exports = { makeWebhook, parseSpec, detectFormat, buildPayload, THROTTLE_MS };
