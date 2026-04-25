'use strict';

const { getPath } = require('./jsonFilter.js');

function formatValue(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function isTemplate(s) {
  return /\{[^}]+\}/.test(s);
}

function makeJsonExtract({ spec = null, keepNonJson = false } = {}) {
  if (!spec) return (line) => line;
  const template = isTemplate(spec) ? spec : null;
  const paths = template ? null : spec.split(',').map((p) => p.trim()).filter(Boolean);
  return function extract(line) {
    let obj;
    try { obj = JSON.parse(line); }
    catch { return keepNonJson ? line : null; }
    if (obj === null || typeof obj !== 'object') return keepNonJson ? line : null;
    if (template) {
      return template.replace(/\{([^}]+)\}/g, (_, key) => formatValue(getPath(obj, key.split('.'))));
    }
    return paths.map((p) => formatValue(getPath(obj, p.split('.')))).join(' ');
  };
}

module.exports = { makeJsonExtract, isTemplate, formatValue };
