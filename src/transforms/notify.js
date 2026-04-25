'use strict';

const { spawn } = require('node:child_process');

const THROTTLE_MS = 5000;
const POWERSHELL_APP_ID = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe';

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitize(s, max) {
  return String(s).replace(/[\x00-\x1f]/g, ' ').slice(0, max);
}

function buildToastScript(title, body) {
  const t = xmlEscape(sanitize(title, 80));
  const b = xmlEscape(sanitize(body, 200));
  return [
    "$ErrorActionPreference = 'SilentlyContinue'",
    '$null = [Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]',
    '$null = [Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom.XmlDocument,ContentType=WindowsRuntime]',
    "$xml = @'",
    `<toast><visual><binding template="ToastGeneric"><text>${t}</text><text>${b}</text></binding></visual></toast>`,
    "'@",
    '$doc = New-Object Windows.Data.Xml.Dom.XmlDocument',
    '$doc.LoadXml($xml)',
    '$toast = New-Object Windows.UI.Notifications.ToastNotification $doc',
    `$appId = '${POWERSHELL_APP_ID}'`,
    '[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)',
  ].join('\n');
}

function defaultFire(title, body) {
  const child = spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', buildToastScript(title, body)], {
    stdio: 'ignore',
    windowsHide: true,
  });
  child.on('error', () => {});
}

function parseSpec(spec) {
  const eq = spec.lastIndexOf('=');
  let pattern, title;
  if (eq === -1) { pattern = spec; title = null; }
  else { pattern = spec.slice(0, eq); title = spec.slice(eq + 1); }
  if (pattern === '') throw new Error(`--notify-on empty pattern: ${spec}`);
  let regex;
  try { regex = new RegExp(pattern); }
  catch (e) { throw new Error(`--notify-on invalid regex '${pattern}': ${e.message}`); }
  return { regex, title, key: pattern };
}

function makeNotifier(specs, deps = {}) {
  const fire = deps.fire || defaultFire;
  const platform = deps.platform || process.platform;
  const stderr = deps.stderr || process.stderr;
  const now = deps.now || (() => Date.now());

  if (!specs || specs.length === 0) return (line) => line;

  if (platform !== 'win32' && !deps.allowAnyPlatform) {
    stderr.write('wintail: --notify-on requires Windows; ignoring.\n');
    return (line) => line;
  }

  const compiled = specs.map(parseSpec);
  const lastFired = new Map();

  return function notifier(line, ctx) {
    const t = now();
    for (const { regex, title, key } of compiled) {
      if (regex.test(line)) {
        const last = lastFired.has(key) ? lastFired.get(key) : -Infinity;
        if (t - last >= THROTTLE_MS) {
          lastFired.set(key, t);
          fire(title || `wintail: ${ctx.source}`, line);
        }
      }
    }
    return line;
  };
}

module.exports = { makeNotifier, parseSpec, buildToastScript, THROTTLE_MS };
