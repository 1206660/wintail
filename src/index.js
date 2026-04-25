'use strict';

const { parseArgs, UsageError } = require('./args.js');
const { HELP_TEXT, VERSION_TEXT } = require('./help.js');
const { readLastLines, readLastBytes, readFromLine, readFromByte } = require('./readTail.js');
const { startFollow, makeStateForFollow } = require('./follow.js');
const { readStdinTail } = require('./stdin.js');
const { installAlias } = require('./installAlias.js');
const { createPipeline } = require('./output.js');
const { expand: expandGlobs } = require('./glob.js');
const { resolveColorMode } = require('./transforms/color.js');
const { makeHighlighter, parseUserHighlights } = require('./transforms/highlight.js');
const { makeGrep } = require('./transforms/grep.js');
const { makeLineNumberer } = require('./transforms/lineNumber.js');
const { makeNotifier } = require('./transforms/notify.js');

const STDIN_NAME = 'standard input';

function describeOpenError(e, file) {
  if (e.code === 'ENOENT') return `cannot open '${file}' for reading: No such file or directory`;
  if (e.code === 'EACCES') return `cannot open '${file}' for reading: Permission denied`;
  if (e.code === 'EISDIR') return `error reading '${file}': Is a directory`;
  return `cannot open '${file}' for reading: ${e.message}`;
}

function buildPipeline(opts, stdout) {
  const transforms = [];

  if (opts.grepPatterns.length > 0) {
    try {
      transforms.push(makeGrep({
        patterns: opts.grepPatterns,
        ignoreCase: opts.ignoreCase,
        invert: false,
      }));
    } catch (e) { throw new UsageError(e.message); }
  }
  if (opts.grepVPatterns.length > 0) {
    try {
      transforms.push(makeGrep({
        patterns: opts.grepVPatterns,
        ignoreCase: opts.ignoreCase,
        invert: true,
      }));
    } catch (e) { throw new UsageError(e.message); }
  }

  const colorEnabled = resolveColorMode(opts, stdout);
  if (colorEnabled) {
    let user;
    try { user = parseUserHighlights(opts.highlights); }
    catch (e) { throw new UsageError(e.message); }
    transforms.push(makeHighlighter({
      user,
      includeBuiltins: !opts.noDefaultHighlight,
      enabled: true,
    }));
  }

  if (opts.lineNumber) transforms.push(makeLineNumberer());

  if (opts.notifyPatterns.length > 0) {
    try { transforms.push(makeNotifier(opts.notifyPatterns)); }
    catch (e) { throw new UsageError(e.message); }
  }

  return createPipeline({ transforms, stdout });
}

async function main(argv, {
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  let opts;
  try { opts = parseArgs(argv); }
  catch (e) {
    if (e instanceof UsageError) {
      stderr.write(`wintail: ${e.message}\n`);
      stderr.write("Try 'wintail --help' for more information.\n");
      process.exit(2);
    }
    throw e;
  }

  if (opts.mode === 'help') { stdout.write(HELP_TEXT); return; }
  if (opts.mode === 'version') { stdout.write(VERSION_TEXT); return; }
  if (opts.mode === 'install-alias') {
    process.exit(installAlias(stdout, stderr));
  }

  // Expand globs in FILE args
  try { opts.files = expandGlobs(opts.files); }
  catch (e) {
    stderr.write(`wintail: ${e.message}\n`);
    process.exit(1);
  }

  let pipeline;
  try { pipeline = buildPipeline(opts, stdout); }
  catch (e) {
    if (e instanceof UsageError) {
      stderr.write(`wintail: ${e.message}\n`);
      stderr.write("Try 'wintail --help' for more information.\n");
      process.exit(2);
    }
    throw e;
  }

  const showHeaders = opts.verbose || (opts.files.length > 1 && !opts.quiet);
  const followStates = [];
  let lastEmittedPath = null;
  let exitCode = 0;

  const emitHeader = (name) => {
    if (!showHeaders) return;
    if (lastEmittedPath === name) return;
    pipeline.flush();
    const prefix = lastEmittedPath !== null ? '\n' : '';
    stdout.write(`${prefix}==> ${name} <==\n`);
    lastEmittedPath = name;
  };

  for (const f of opts.files) {
    if (f === '-') {
      emitHeader(STDIN_NAME);
      try { await readStdinTail(opts, stdin, pipeline, STDIN_NAME); }
      catch (e) { stderr.write(`wintail: standard input: ${e.message}\n`); exitCode = 1; }
      continue;
    }

    let buf;
    try {
      if (opts.bytes) {
        buf = opts.bytes.from === 'end'
          ? readLastBytes(f, opts.bytes.count)
          : readFromByte(f, opts.bytes.count);
      } else {
        buf = opts.lines.from === 'end'
          ? readLastLines(f, opts.lines.count, opts.encoding)
          : readFromLine(f, opts.lines.count, opts.encoding);
      }
    } catch (e) {
      stderr.write(`wintail: ${describeOpenError(e, f)}\n`);
      exitCode = 1;
      if (opts.follow === 'name') {
        followStates.push({
          path: f, fd: null, offset: 0, size: 0,
          mtimeMs: 0, birthtimeMs: 0, encoding: opts.encoding, missing: true,
        });
      }
      continue;
    }

    emitHeader(f);
    if (buf.length > 0) pipeline.writeChunk(buf, f);

    if (opts.follow) {
      const st = makeStateForFollow(f, opts.encoding);
      if (st.fd === null && opts.follow !== 'name') {
        // -f on a vanished file: skip
      } else {
        followStates.push(st);
      }
    }
  }

  if (opts.follow && followStates.length > 0) {
    startFollow({
      files: followStates,
      lastEmittedPath,
      showHeaders,
      opts,
      pipeline,
      stdout,
      stderr,
    });
    return;
  }

  pipeline.flush();
  if (exitCode !== 0) process.exit(exitCode);
}

module.exports = { main, buildPipeline };
