'use strict';

const { makeWrap } = require('./color.js');

const RE_UE_LINE = /^(\[[\d.\-:]+\])(\[[\s\d]+\])([A-Za-z][\w]*?):\s*(?:(Fatal|Error|Warning|Display|Log|Verbose|VeryVerbose):\s*)?(.*)$/;

const SEVERITY_CODES = {
  Fatal:       '1;35',     // bold magenta
  Error:       '1;31',     // bold red
  Warning:     '33',       // yellow
  Display:     null,       // default
  Log:         null,
  Verbose:     '2',        // dim
  VeryVerbose: '2',
};

const CHANNEL_PALETTE = ['36', '35', '32', '34', '93', '95', '92', '94', '96', '33', '91', '37'];

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function colorForChannel(name) {
  return CHANNEL_PALETTE[hashString(name) % CHANNEL_PALETTE.length];
}

function makeUeFormatter({ enabled = true } = {}) {
  const wrap = makeWrap(enabled);
  return function ue(line) {
    const m = RE_UE_LINE.exec(line);
    if (!m) {
      // Likely stack continuation or non-UE; indent dim
      if (line.length === 0) return line;
      if (line.startsWith('  ') || line.startsWith('\t')) {
        return wrap(line, '2');
      }
      return line;
    }
    const [, ts, frame, channel, severity, message] = m;
    const channelColored = wrap(channel, colorForChannel(channel));
    const sevCode = severity ? SEVERITY_CODES[severity] : null;
    let sevPart = '';
    if (severity) {
      sevPart = sevCode ? `${wrap(severity, sevCode)}: ` : `${severity}: `;
    }
    const tsDim = wrap(ts, '2');
    const frameDim = wrap(frame, '2');
    return `${tsDim}${frameDim}${channelColored}: ${sevPart}${message}`;
  };
}

module.exports = { makeUeFormatter, colorForChannel, hashString };
