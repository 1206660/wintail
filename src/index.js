'use strict';

const { parseArgs, UsageError } = require('./args.js');
const { HELP_TEXT, VERSION_TEXT } = require('./help.js');
const { readLastLines, readLastBytes, readFromLine, readFromByte } = require('./readTail.js');
const { startFollow, makeStateForFollow } = require('./follow.js');
const { readStdinTail } = require('./stdin.js');
const { installAlias } = require('./installAlias.js');

const STDIN_NAME = 'standard input';

function describeOpenError(e, file) {
  if (e.code === 'ENOENT') return `cannot open '${file}' for reading: No such file or directory`;
  if (e.code === 'EACCES') return `cannot open '${file}' for reading: Permission denied`;
  if (e.code === 'EISDIR') return `error reading '${file}': Is a directory`;
  return `cannot open '${file}' for reading: ${e.message}`;
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

  const showHeaders = opts.verbose || (opts.files.length > 1 && !opts.quiet);
  const followStates = [];
  let lastEmittedPath = null;
  let exitCode = 0;

  const emitHeader = (name) => {
    if (!showHeaders) return;
    if (lastEmittedPath === name) return;
    const prefix = lastEmittedPath !== null ? '\n' : '';
    stdout.write(`${prefix}==> ${name} <==\n`);
    lastEmittedPath = name;
  };

  for (const f of opts.files) {
    if (f === '-') {
      emitHeader(STDIN_NAME);
      try { await readStdinTail(opts, stdin, stdout); }
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
    if (buf.length > 0) stdout.write(buf);

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
      stdout,
      stderr,
    });
    return;
  }

  if (exitCode !== 0) process.exit(exitCode);
}

module.exports = { main };
