'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTimestamp, parseSpec } = require('../src/timestamps.js');

test('UE format', () => {
  const t = parseTimestamp('[2026.04.26-10.30.45:123][  0]LogTemp: hello');
  const d = new Date(t);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 3);  // April
  assert.equal(d.getDate(), 26);
  assert.equal(d.getHours(), 10);
  assert.equal(d.getMinutes(), 30);
  assert.equal(d.getSeconds(), 45);
  assert.equal(d.getMilliseconds(), 123);
});

test('ISO 8601 with T and Z', () => {
  const t = parseTimestamp('2026-04-26T10:30:45.500Z some message');
  assert.equal(t, Date.parse('2026-04-26T10:30:45.500Z'));
});

test('ISO 8601 with space, no TZ (local)', () => {
  const t = parseTimestamp('2026-04-26 10:30:45 stuff');
  const d = new Date(t);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 3);
  assert.equal(d.getHours(), 10);
});

test('Common datetime', () => {
  const t = parseTimestamp('2026-04-26 10:30:45 INFO log');
  assert.ok(t > 0);
});

test('Syslog Apr 26 10:30:45', () => {
  const ref = new Date(2026, 3, 27, 12, 0, 0);
  const t = parseTimestamp('Apr 26 10:30:45 host service: msg', ref);
  const d = new Date(t);
  assert.equal(d.getMonth(), 3);
  assert.equal(d.getDate(), 26);
});

test('Syslog year inference: month in future = previous year', () => {
  const ref = new Date(2026, 0, 5, 12, 0, 0); // Jan 5 2026
  const t = parseTimestamp('Dec 30 12:00:00 something', ref);
  const d = new Date(t);
  assert.equal(d.getFullYear(), 2025);
  assert.equal(d.getMonth(), 11);
});

test('Bracket time-only', () => {
  const ref = new Date(2026, 0, 5);
  const t = parseTimestamp('[12:34:56.789] message', ref);
  const d = new Date(t);
  assert.equal(d.getHours(), 12);
  assert.equal(d.getMinutes(), 34);
  assert.equal(d.getMilliseconds(), 789);
});

test('No timestamp returns null', () => {
  assert.equal(parseTimestamp('plain text with no time'), null);
});

test('parseSpec relative: 5m', () => {
  const ref = new Date(2026, 3, 26, 10, 30, 0);
  const t = parseSpec('5m', ref);
  assert.equal(ref.getTime() - t, 5 * 60 * 1000);
});

test('parseSpec relative: 2h', () => {
  const ref = new Date(2026, 3, 26, 10, 30, 0);
  assert.equal(ref.getTime() - parseSpec('2h', ref), 2 * 3600 * 1000);
});

test('parseSpec relative: 1d', () => {
  const ref = new Date(2026, 3, 26, 10, 30, 0);
  assert.equal(ref.getTime() - parseSpec('1d', ref), 86400 * 1000);
});

test('parseSpec relative: 30s', () => {
  const ref = new Date(2026, 3, 26, 10, 30, 0);
  assert.equal(ref.getTime() - parseSpec('30s', ref), 30 * 1000);
});

test('parseSpec today HH:MM', () => {
  const ref = new Date(2026, 3, 26, 14, 0, 0);
  const t = parseSpec('10:30', ref);
  const d = new Date(t);
  assert.equal(d.getHours(), 10);
  assert.equal(d.getMinutes(), 30);
  assert.equal(d.getDate(), 26);
});

test('parseSpec UE format inside spec', () => {
  const t = parseSpec('[2026.04.26-10.30.45]');
  const d = new Date(t);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getHours(), 10);
});

test('parseSpec rejects garbage', () => {
  assert.throws(() => parseSpec('not a time'));
});
