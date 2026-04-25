'use strict';

const { makeWrap, parseColorSpec } = require('./color.js');
const { getTheme } = require('../themes.js');

function builtinPatternsForTheme(themeName = 'default') {
  const t = getTheme(themeName);
  return [
    { regex: /\b(error|fatal|panic)\b/gi, codeKey: t.error },
    { regex: /\b(warn(?:ing)?)\b/gi,      codeKey: t.warn },
    { regex: /\b(info)\b/gi,              codeKey: t.info },
    { regex: /\b(debug|verbose|trace)\b/gi, codeKey: t.debug },
  ];
}

const BUILTIN_PATTERNS = builtinPatternsForTheme('default');

function parseUserHighlights(specs) {
  // specs: array of strings like 'pattern=color' or 'pattern=red bold'
  const out = [];
  for (const spec of specs || []) {
    const eq = spec.lastIndexOf('=');
    if (eq === -1) throw new Error(`--highlight needs PATTERN=COLOR: ${spec}`);
    const pattern = spec.slice(0, eq);
    const colorStr = spec.slice(eq + 1);
    if (pattern === '') throw new Error(`--highlight empty pattern: ${spec}`);
    let regex;
    try { regex = new RegExp(pattern, 'g'); }
    catch (e) { throw new Error(`--highlight invalid regex '${pattern}': ${e.message}`); }
    const codeKey = parseColorSpec(colorStr);
    out.push({ regex, codeKey });
  }
  return out;
}

function makeHighlighter({ user = [], includeBuiltins = true, enabled = true, theme = 'default' } = {}) {
  const wrap = makeWrap(enabled);
  // user patterns first (higher priority), then built-ins from selected theme
  const patterns = [...user];
  if (includeBuiltins) patterns.push(...builtinPatternsForTheme(theme));

  if (!enabled || patterns.length === 0) return (line) => line;

  return function highlight(line) {
    if (line.length === 0) return line;
    // Find non-overlapping matches across all patterns; first-pattern-wins.
    const segments = [];
    let cursor = 0;
    while (cursor < line.length) {
      let bestIdx = -1, bestEnd = -1, bestCode = null;
      for (const { regex, codeKey } of patterns) {
        regex.lastIndex = cursor;
        const m = regex.exec(line);
        if (m && (bestIdx === -1 || m.index < bestIdx)) {
          bestIdx = m.index;
          bestEnd = m.index + m[0].length;
          bestCode = codeKey;
          if (m.index === cursor) break;
        }
      }
      if (bestIdx === -1) {
        segments.push(line.slice(cursor));
        break;
      }
      if (bestIdx > cursor) segments.push(line.slice(cursor, bestIdx));
      segments.push(wrap(line.slice(bestIdx, bestEnd), bestCode));
      cursor = bestEnd;
    }
    return segments.join('');
  };
}

module.exports = { makeHighlighter, parseUserHighlights, BUILTIN_PATTERNS, builtinPatternsForTheme };
