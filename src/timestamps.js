'use strict';

const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

const RE_UE = /\[(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})(?::(\d{3}))?\]/;
const RE_ISO = /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?/;
const RE_COMMON = /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/;
const RE_SYSLOG = /^(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})/;
const RE_BRACKET_TIME = /^\[(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?\]/;

function parseTimestamp(line, refDate = new Date()) {
  let m;
  if ((m = RE_UE.exec(line))) {
    const ms = m[7] ? +m[7] : 0;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], ms).getTime();
  }
  if ((m = RE_ISO.exec(line))) {
    const ms = m[7] ? parseInt(m[7].slice(0, 3).padEnd(3, '0'), 10) : 0;
    const tz = m[8];
    if (tz) {
      const norm = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${String(ms).padStart(3, '0')}${tz}`;
      const t = Date.parse(norm);
      if (!Number.isNaN(t)) return t;
    }
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], ms).getTime();
  }
  if ((m = RE_COMMON.exec(line))) {
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
  }
  if ((m = RE_SYSLOG.exec(line))) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month === undefined) return null;
    let year = refDate.getFullYear();
    const candidate = new Date(year, month, +m[2], +m[3], +m[4], +m[5]).getTime();
    if (candidate > refDate.getTime() + 86400000) {
      return new Date(year - 1, month, +m[2], +m[3], +m[4], +m[5]).getTime();
    }
    return candidate;
  }
  if ((m = RE_BRACKET_TIME.exec(line))) {
    const ms = m[4] ? parseInt(m[4].slice(0, 3).padEnd(3, '0'), 10) : 0;
    const d = new Date(refDate);
    d.setHours(+m[1], +m[2], +m[3], ms);
    return d.getTime();
  }
  return null;
}

function parseSpec(spec, refDate = new Date()) {
  if (typeof spec !== 'string' || spec.length === 0) {
    throw new Error(`empty timestamp spec`);
  }
  const rel = /^(\d+(?:\.\d+)?)(ms|s|m|h|d|w)$/.exec(spec);
  if (rel) {
    const n = parseFloat(rel[1]);
    const mult = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 }[rel[2]];
    return refDate.getTime() - n * mult;
  }
  const todayTime = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(spec);
  if (todayTime) {
    const d = new Date(refDate);
    d.setHours(+todayTime[1], +todayTime[2], +(todayTime[3] || 0), 0);
    return d.getTime();
  }
  const t = parseTimestamp(spec, refDate);
  if (t !== null) return t;
  const fallback = Date.parse(spec);
  if (!Number.isNaN(fallback)) return fallback;
  throw new Error(`unrecognized timestamp spec: ${spec}`);
}

module.exports = { parseTimestamp, parseSpec };
