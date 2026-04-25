'use strict';

const fs = require('node:fs');
const { decodeChunk } = require('./encoding.js');

const MIN_INTERVAL_MS = 50;

function statSafe(p) {
  try { return fs.statSync(p); }
  catch (e) {
    if (e.code === 'ENOENT' || e.code === 'EACCES') return null;
    throw e;
  }
}

function openSafe(p) {
  try { return fs.openSync(p, 'r'); }
  catch (e) {
    if (e.code === 'ENOENT' || e.code === 'EACCES') return null;
    throw e;
  }
}

function makeHeaderEmitter(stdout, lastEmittedPath, showHeaders, pipeline) {
  let last = lastEmittedPath;
  return function emit(path) {
    if (!showHeaders) return;
    if (last === path) return;
    if (pipeline && typeof pipeline.flush === 'function') pipeline.flush();
    const prefix = last !== null ? '\n' : '';
    stdout.write(`${prefix}==> ${path} <==\n`);
    last = path;
  };
}

function readAllFrom(fd, fromOffset, toSize) {
  const need = toSize - fromOffset;
  const buf = Buffer.alloc(need);
  let read = 0;
  while (read < need) {
    const n = fs.readSync(fd, buf, read, need - read, fromOffset + read);
    if (n === 0) break;
    read += n;
  }
  return buf.subarray(0, read);
}

function writeChunk(target, slice, encoding, source) {
  // target may be a stream (legacy) or a pipeline ({ writeChunk })
  const buf = (encoding === 'utf16le' || encoding === 'utf16be')
    ? Buffer.from(decodeChunk(slice, encoding), 'utf8')
    : slice;
  if (target && typeof target.writeChunk === 'function') target.writeChunk(buf, source);
  else target.write(buf);
}

function reopenAndReadAll(state, target, stderr, emitHeader, msg) {
  const newFd = openSafe(state.path);
  if (!newFd) {
    state.fd = null;
    state.missing = true;
    return;
  }
  state.fd = newFd;
  state.missing = false;
  const ns = fs.fstatSync(newFd);
  state.offset = 0;
  state.size = ns.size;
  state.mtimeMs = ns.mtimeMs;
  state.birthtimeMs = ns.birthtimeMs;
  stderr.write(msg);
  if (ns.size > 0) {
    emitHeader(state.path);
    const slice = readAllFrom(newFd, 0, ns.size);
    writeChunk(target, slice, state.encoding, state.path);
    state.offset = ns.size;
  }
}

function pollFile(state, target, stderr, opts, emitHeader) {
  // Case 1: no current fd (only happens with -F)
  if (state.fd === null) {
    if (opts.follow !== 'name') return;
    if (statSafe(state.path)) {
      reopenAndReadAll(state, target, stderr, emitHeader,
        `wintail: '${state.path}' has appeared; following new file\n`);
    }
    return;
  }

  // Stat the current fd
  let fdStat;
  try { fdStat = fs.fstatSync(state.fd); }
  catch (e) {
    stderr.write(`wintail: ${state.path}: ${e.message}\n`);
    return;
  }

  // For -F also stat the path to detect rotation/deletion
  let pathStat = null;
  if (opts.follow === 'name') {
    pathStat = statSafe(state.path);
    if (!pathStat) {
      try { fs.closeSync(state.fd); } catch {}
      state.fd = null;
      if (!state.missing) {
        stderr.write(`wintail: ${state.path}: No such file or directory\n`);
      }
      state.missing = true;
      return;
    }
  }

  // Truncation on the open fd: read from 0
  if (fdStat.size < state.offset) {
    stderr.write(`wintail: ${state.path}: file truncated\n`);
    state.offset = 0;
    state.size = 0;
  }

  // Append on the open fd
  if (fdStat.size > state.offset) {
    emitHeader(state.path);
    const slice = readAllFrom(state.fd, state.offset, fdStat.size);
    writeChunk(target, slice, state.encoding, state.path);
    state.offset += slice.length;
    state.size = fdStat.size;
    state.mtimeMs = fdStat.mtimeMs;
  }

  // -F: did the path get replaced by a different file?
  if (opts.follow === 'name' && pathStat) {
    const replaced =
      pathStat.size !== fdStat.size ||
      Math.abs(pathStat.mtimeMs - fdStat.mtimeMs) > 1;
    if (replaced) {
      try { fs.closeSync(state.fd); } catch {}
      reopenAndReadAll(state, target, stderr, emitHeader,
        `wintail: '${state.path}' has been replaced; following new file\n`);
    }
  }
}

function makeTicker({ files, lastEmittedPath, showHeaders, opts, pipeline, stdout = process.stdout, stderr = process.stderr }) {
  const target = pipeline || stdout;
  const emitHeader = makeHeaderEmitter(stdout, lastEmittedPath, showHeaders, pipeline);
  return function tickOnce() {
    for (const state of files) {
      try { pollFile(state, target, stderr, opts, emitHeader); }
      catch (e) {
        stderr.write(`wintail: ${state.path}: ${e.message}\n`);
      }
    }
  };
}

function startFollow(args) {
  const opts = args.opts;
  const tickOnce = makeTicker(args);
  const intervalMs = Math.max(MIN_INTERVAL_MS, Math.round(opts.sleepInterval * 1000));
  let stopped = false;

  function stop(code) {
    if (stopped) return;
    stopped = true;
    clearInterval(handle);
    if (args.pipeline && typeof args.pipeline.flush === 'function') {
      try { args.pipeline.flush(); } catch {}
    }
    if (args.pipeline && args.pipeline.statsCollector) {
      try { args.pipeline.statsCollector.stop(); } catch {}
    }
    if (args.pipeline && args.pipeline.summary) {
      try { args.pipeline.summary.report(process.stderr); } catch {}
    }
    let finalCode = code;
    if (args.pipeline && args.pipeline.exitCodeWatcher) {
      const m = args.pipeline.exitCodeWatcher.getMatched();
      if (m && m.code > 0) {
        try { process.stderr.write(`wintail: exit-code-on-match: '${m.pattern}' matched → exit ${m.code}\n`); } catch {}
        finalCode = m.code;
      }
    }
    for (const s of args.files) {
      if (s.fd !== null) {
        try { fs.closeSync(s.fd); } catch {}
        s.fd = null;
      }
    }
    if (typeof finalCode === 'number') process.exit(finalCode);
  }

  const tick = () => {
    if (stopped) return;
    tickOnce();
    if (opts.pid !== null) {
      try { process.kill(opts.pid, 0); }
      catch (e) { if (e.code === 'ESRCH') stop(0); }
    }
  };

  const handle = setInterval(tick, intervalMs);
  process.on('SIGINT', () => stop(130));
  process.on('SIGTERM', () => stop(143));

  return { stop };
}

function makeStateForFollow(filePath, encoding = 'utf8') {
  const fd = openSafe(filePath);
  if (!fd) {
    return { path: filePath, fd: null, offset: 0, size: 0, mtimeMs: 0, birthtimeMs: 0, encoding, missing: true };
  }
  const st = fs.fstatSync(fd);
  return {
    path: filePath,
    fd,
    offset: st.size,
    size: st.size,
    mtimeMs: st.mtimeMs,
    birthtimeMs: st.birthtimeMs,
    encoding,
    missing: false,
  };
}

module.exports = { startFollow, makeTicker, makeHeaderEmitter, makeStateForFollow, pollFile };
