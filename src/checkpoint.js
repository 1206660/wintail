'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FLUSH_EVERY_MS = 2000;

function loadCheckpoint(filePath) {
  if (!filePath) return {};
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const obj = JSON.parse(text);
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return {};
    return obj;
  } catch {
    return {};
  }
}

function saveCheckpoint(filePath, data) {
  if (!filePath) return;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // best-effort
  }
}

// Apply checkpoint to a follow-state list: for any state whose path matches
// a key in `cp`, set state.offset to the saved value (clamped to current size).
function applyToStates(states, cp, { stderr = process.stderr } = {}) {
  if (!cp || Object.keys(cp).length === 0) return 0;
  let applied = 0;
  for (const st of states) {
    const saved = cp[path.resolve(st.path)] || cp[st.path];
    if (typeof saved === 'number' && saved >= 0) {
      const clamped = Math.min(saved, st.size);
      if (clamped !== st.offset) {
        st.offset = clamped;
        applied++;
        stderr.write(`wintail: resumed ${st.path} at byte ${clamped}\n`);
      }
    }
  }
  return applied;
}

function snapshotStates(states) {
  const out = {};
  for (const st of states) {
    out[path.resolve(st.path)] = st.offset || 0;
  }
  return out;
}

function startFlusher({ filePath, getStates, intervalMs = FLUSH_EVERY_MS } = {}) {
  if (!filePath) return { stop: () => {} };
  const handle = setInterval(() => {
    try { saveCheckpoint(filePath, snapshotStates(getStates())); }
    catch {}
  }, intervalMs);
  if (handle.unref) handle.unref();
  return {
    stop: () => {
      clearInterval(handle);
      saveCheckpoint(filePath, snapshotStates(getStates()));
    },
  };
}

module.exports = { loadCheckpoint, saveCheckpoint, applyToStates, snapshotStates, startFlusher };
