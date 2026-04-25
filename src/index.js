'use strict';

const { parseArgs, UsageError, defaultOpts } = require('./args.js');
const { loadConfig, applyToOpts } = require('./config.js');
const { HELP_TEXT, VERSION_TEXT } = require('./help.js');
const { readLastLines, readLastBytes, readFromLine, readFromByte, readFirstLines, isGzipPath } = require('./readTail.js');
const { startFollow, makeStateForFollow } = require('./follow.js');
const { readStdinTail } = require('./stdin.js');
const { installAlias, uninstallAlias } = require('./installAlias.js');
const { createPipeline } = require('./output.js');
const { expand: expandGlobs } = require('./glob.js');
const { resolveColorMode } = require('./transforms/color.js');
const { makeHighlighter, parseUserHighlights } = require('./transforms/highlight.js');
const { makeGrep } = require('./transforms/grep.js');
const { makeLineNumberer } = require('./transforms/lineNumber.js');
const { makeNotifier } = require('./transforms/notify.js');
const { makeWebhook } = require('./transforms/webhook.js');
const { makePrettyJson } = require('./transforms/prettyJson.js');
const { makeSinceFilter } = require('./transforms/since.js');
const { makeUeFormatter } = require('./transforms/ue.js');
const { makeAddTimestamp } = require('./transforms/addTimestamp.js');
const { makeTruncate } = require('./transforms/truncate.js');
const { createTeeOutput } = require('./multiOut.js');
const { makeStripAnsi } = require('./transforms/stripAnsi.js');
const { makeCollapseRepeats } = require('./transforms/collapseRepeats.js');
const { makeSqueezeBlank } = require('./transforms/squeezeBlank.js');
const { createStatsCollector } = require('./transforms/stats.js');
const { makeJsonFilter } = require('./transforms/jsonFilter.js');
const { makeJsonExtract } = require('./transforms/jsonExtract.js');
const { makeRegexExtract } = require('./transforms/regexExtract.js');
const { makeMaxLines } = require('./transforms/maxLines.js');
const { makePrefix } = require('./transforms/prefix.js');
const { startMarker } = require('./marker.js');
const { createWebServer, makeWebTee } = require('./web.js');
const { recordInvocation, listHistory, pickFromHistory } = require('./history.js');
const { generate: generateCompletion } = require('./completions.js');
const { replayFile } = require('./replay.js');
const { startWatch } = require('./watch.js');
const { makeTagger } = require('./transforms/tag.js');
const { makeRateLimit } = require('./transforms/rateLimit.js');
const { makeSample } = require('./transforms/sample.js');
const { makeExitCodeWatcher } = require('./exitCodeOnMatch.js');
const { makeShowNonPrinting } = require('./transforms/showNonPrinting.js');
const { makeGrepWithContext } = require('./transforms/grepContext.js');
const { createSummary } = require('./transforms/summary.js');
const { makeLimitBytes } = require('./transforms/limitBytes.js');
const { emitDiff } = require('./diff.js');
const { loadPlugins } = require('./plugin.js');
const { reverseBuffer } = require('./transforms/reverse.js');

const STDIN_NAME = 'standard input';

function describeOpenError(e, file) {
  if (e.code === 'ENOENT') return `cannot open '${file}' for reading: No such file or directory`;
  if (e.code === 'EACCES') return `cannot open '${file}' for reading: Permission denied`;
  if (e.code === 'EISDIR') return `error reading '${file}': Is a directory`;
  return `cannot open '${file}' for reading: ${e.message}`;
}

function buildPipeline(opts, stdout, stderr) {
  const transforms = [];
  let statsCollector = null;

  if (opts.showNonPrinting) transforms.push(makeShowNonPrinting({ color: resolveColorMode(opts, stdout) }));
  if (opts.stripAnsi) transforms.push(makeStripAnsi());
  if (opts.squeezeBlank) transforms.push(makeSqueezeBlank());
  if (opts.collapseRepeats) transforms.push(makeCollapseRepeats());
  if (opts.stats) {
    statsCollector = createStatsCollector({ intervalSec: opts.statsInterval, stderr });
    transforms.push(statsCollector.transform);
  }

  if (opts.since !== null || opts.until !== null) {
    try {
      transforms.push(makeSinceFilter({
        since: opts.since !== null ? opts.since : undefined,
        until: opts.until !== null ? opts.until : undefined,
      }));
    } catch (e) { throw new UsageError(e.message); }
  }

  if (opts.jsonFilters.length > 0) {
    try {
      transforms.push(makeJsonFilter({
        specs: opts.jsonFilters,
        keepNonJson: opts.jsonKeepNonJson,
      }));
    } catch (e) { throw new UsageError(e.message); }
  }

  if (opts.jsonExtract) {
    transforms.push(makeJsonExtract({
      spec: opts.jsonExtract,
      keepNonJson: opts.jsonKeepNonJson,
    }));
  }

  if (opts.plugins.length > 0) {
    try { transforms.push(...loadPlugins(opts.plugins)); }
    catch (e) { throw new UsageError(e.message); }
  }

  if (opts.regexExtract) {
    try {
      transforms.push(makeRegexExtract({
        pattern: opts.regexExtract,
        ignoreCase: opts.ignoreCase,
        keepNonMatch: opts.regexExtractKeepNonMatch,
      }));
    } catch (e) { throw new UsageError(e.message); }
  }

  if (opts.grepPatterns.length > 0) {
    try {
      const useContext = opts.contextBefore > 0 || opts.contextAfter > 0;
      if (useContext) {
        transforms.push(makeGrepWithContext({
          patterns: opts.grepPatterns,
          ignoreCase: opts.ignoreCase,
          mode: opts.grepAnd ? 'and' : 'or',
          before: opts.contextBefore,
          after: opts.contextAfter,
        }));
      } else {
        transforms.push(makeGrep({
          patterns: opts.grepPatterns,
          ignoreCase: opts.ignoreCase,
          invert: false,
          mode: opts.grepAnd ? 'and' : 'or',
        }));
      }
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
    try {
      transforms.push(makeHighlighter({
        user,
        includeBuiltins: !opts.noDefaultHighlight,
        enabled: true,
        theme: opts.theme,
      }));
    } catch (e) { throw new UsageError(e.message); }
  }

  if (opts.prettyJson) transforms.push(makePrettyJson());
  if (opts.ue) transforms.push(makeUeFormatter({ enabled: colorEnabled }));

  if (opts.addTimestamp) {
    try { transforms.push(makeAddTimestamp({ format: opts.addTimestamp, color: colorEnabled })); }
    catch (e) { throw new UsageError(e.message); }
  }

  if (opts.prefix) {
    transforms.push(makePrefix({ template: opts.prefix, color: colorEnabled }));
  }

  if (opts.tagSpecs.length > 0) {
    try { transforms.push(makeTagger({ specs: opts.tagSpecs, color: colorEnabled })); }
    catch (e) { throw new UsageError(e.message); }
  }

  if (opts.rateLimit > 0) transforms.push(makeRateLimit({ perSec: opts.rateLimit }));
  if (opts.every > 1) transforms.push(makeSample({ every: opts.every }));

  let exitCodeWatcher = null;
  if (opts.exitCodeMatchSpecs.length > 0) {
    try { exitCodeWatcher = makeExitCodeWatcher(opts.exitCodeMatchSpecs); }
    catch (e) { throw new UsageError(e.message); }
    transforms.push(exitCodeWatcher.transform);
  }

  let summary = null;
  if (opts.summary) {
    summary = createSummary({ topN: opts.summaryTop, normalize: !opts.summaryNoNormalize });
    transforms.push(summary.transform);
  }

  if (opts.lineNumber) transforms.push(makeLineNumberer());

  if (opts.notifyPatterns.length > 0) {
    try { transforms.push(makeNotifier(opts.notifyPatterns)); }
    catch (e) { throw new UsageError(e.message); }
  }
  if (opts.webhookSpecs.length > 0) {
    try { transforms.push(makeWebhook(opts.webhookSpecs)); }
    catch (e) { throw new UsageError(e.message); }
  }

  if (opts.truncate) {
    transforms.push(makeTruncate({ width: opts.truncateWidth, stdout }));
  }

  if (opts.maxLines > 0) {
    transforms.push(makeMaxLines({ limit: opts.maxLines }));
  }
  if (opts.limitBytes > 0) {
    transforms.push(makeLimitBytes({ limit: opts.limitBytes }));
  }

  const translateInput = opts.nullData
    ? (s) => s.indexOf('\0') === -1 ? s : s.replace(/\0/g, '\n')
    : null;
  const pipe = createPipeline({ transforms, stdout, translateInput });
  pipe.statsCollector = statsCollector;
  pipe.exitCodeWatcher = exitCodeWatcher;
  pipe.summary = summary;
  return pipe;
}

async function main(argv, {
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  let opts;
  let baseOpts;
  try {
    const cfg = loadConfig(argv);
    baseOpts = applyToOpts(defaultOpts(), cfg.settings);
    if (cfg.source) {
      stderr.write(`wintail: loaded config from ${cfg.source}${cfg.profile ? ` (profile: ${cfg.profile})` : ''}\n`);
    }
  } catch (e) {
    stderr.write(`wintail: ${e.message}\n`);
    process.exit(2);
  }

  try { opts = parseArgs(argv, baseOpts); }
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
  if (opts.mode === 'uninstall-alias') {
    process.exit(uninstallAlias(stdout, stderr));
  }
  if (opts.mode === 'history') {
    listHistory({ stdout });
    return;
  }
  if (opts.mode === 'diff') {
    if (opts.files.length !== 2) {
      stderr.write('wintail: --diff requires exactly two FILE arguments\n');
      process.exit(2);
    }
    try {
      emitDiff(opts.files[0], opts.files[1], {
        showCommon: opts.diffShowCommon,
        color: resolveColorMode(opts, stdout),
        write: (s) => stdout.write(s),
      });
    } catch (e) {
      stderr.write(`wintail: ${e.message}\n`);
      process.exit(1);
    }
    return;
  }
  if (opts.mode === 'completion') {
    try { stdout.write(generateCompletion(opts.completionShell)); }
    catch (e) {
      stderr.write(`wintail: ${e.message}\n`);
      process.exit(2);
    }
    return;
  }
  if (opts.mode === 'resume') {
    const picked = await pickFromHistory({
      preselect: opts.resumeIndex,
      stdin, stdout, stderr,
    });
    if (!picked) process.exit(1);
    stderr.write(`wintail: → ${['wintail', ...picked.args].join(' ')}\n`);
    return main(picked.args, { stdin, stdout, stderr });
  }

  // Record this invocation in history (best-effort, ignore IO errors)
  recordInvocation(argv, { skip: opts.mode !== 'tail' });

  // --watch CMD takes over: shell command output flows through pipeline
  // periodically. FILE args are ignored when --watch is set.
  if (opts.watch) {
    if (opts.files.length > 0 && !(opts.files.length === 1 && opts.files[0] === '-')) {
      stderr.write(`wintail: --watch active; ignoring FILE args\n`);
    }
    opts.files = [];  // skip the file loop entirely
  }

  // Expand globs / directory FILE args
  try { opts.files = expandGlobs(opts.files, { dirPattern: opts.dirGlob }); }
  catch (e) {
    stderr.write(`wintail: ${e.message}\n`);
    process.exit(1);
  }

  // Reject -f/-F on .gz (they don't grow)
  if (opts.follow) {
    const gz = opts.files.find(isGzipPath);
    if (gz) {
      stderr.write(`wintail: cannot follow '${gz}': .gz files do not grow\n`);
      process.exit(1);
    }
  }

  // Wrap stdout with file-tee if --save
  let outputTarget = stdout;
  if (opts.save) {
    try { outputTarget = createTeeOutput(stdout, opts.save, { append: opts.saveAppend }); }
    catch (e) {
      stderr.write(`wintail: cannot save to '${opts.save}': ${e.message}\n`);
      process.exit(1);
    }
  }

  // Wrap with web-tee if --web (server starts and stays up while wintail runs)
  let webServer = null;
  if (opts.web) {
    try {
      const title = opts.files.filter(f => f !== '-').join(', ') || 'stdin';
      webServer = await createWebServer({
        bind: opts.web,
        token: opts.webToken,
        title,
        stderr,
        metricsProvider: () => {
          if (pipeline && pipeline.statsCollector) return pipeline.statsCollector.snapshot();
          return {};
        },
      });
    } catch (e) {
      stderr.write(`wintail: ${e.message}\n`);
      process.exit(1);
    }
    outputTarget = makeWebTee(outputTarget, webServer);
  }

  let pipeline;
  try { pipeline = buildPipeline(opts, outputTarget, stderr); }
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
    outputTarget.write(`${prefix}==> ${name} <==\n`);
    lastEmittedPath = name;
  };

  // --tail-from-now: skip initial print, only set up follow state
  const skipInitialRead = opts.tailFromNow && opts.follow;

  for (const f of opts.files) {
    if (skipInitialRead && f !== '-') {
      const st = makeStateForFollow(f, opts.encoding);
      if (st.fd === null && opts.follow !== 'name') continue;
      followStates.push(st);
      continue;
    }
    if (f === '-') {
      emitHeader(STDIN_NAME);
      try { await readStdinTail(opts, stdin, pipeline, STDIN_NAME); }
      catch (e) { stderr.write(`wintail: standard input: ${e.message}\n`); exitCode = 1; }
      continue;
    }

    if (opts.replay) {
      emitHeader(f);
      try {
        await replayFile(f, {
          rate: opts.replay,
          write: (s) => pipeline.writeChunk(s, f),
        });
      } catch (e) {
        stderr.write(`wintail: ${describeOpenError(e, f)}\n`);
        exitCode = 1;
      }
      continue;
    }

    let buf;
    try {
      if (opts.head > 0) {
        buf = readFirstLines(f, opts.head, opts.encoding);
      } else if (opts.bytes) {
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
    if (opts.reverse && buf.length > 0) buf = reverseBuffer(buf);
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

  // --watch: spin up the periodic command runner instead of file follow.
  if (opts.watch) {
    if (pipeline.statsCollector) pipeline.statsCollector.start();
    startWatch({
      command: opts.watch,
      intervalSec: opts.watchInterval,
      pipeline,
      stderr,
      emitHeader: showHeaders ? emitHeader : null,
    });
    process.on('SIGINT', () => process.exit(130));
    return;
  }

  if (opts.follow && followStates.length > 0) {
    if (pipeline.statsCollector) pipeline.statsCollector.start();
    let marker = null;
    if (opts.mark > 0) {
      marker = startMarker({
        intervalSec: opts.mark,
        stderr,
        color: resolveColorMode(opts, stdout),
      });
    }
    startFollow({
      files: followStates,
      lastEmittedPath,
      showHeaders,
      opts,
      pipeline,
      stdout: outputTarget,
      stderr,
    });
    return;
  }

  pipeline.flush();
  if (pipeline.statsCollector) pipeline.statsCollector.report();
  if (pipeline.summary) pipeline.summary.report(stderr);
  if (pipeline.exitCodeWatcher) {
    const m = pipeline.exitCodeWatcher.getMatched();
    if (m) {
      stderr.write(`wintail: exit-code-on-match: '${m.pattern}' matched → exit ${m.code}\n`);
      if (m.code > exitCode) exitCode = m.code;
    }
  }
  // If --web was set without -f, keep the server alive so the user can browse
  // the captured snapshot until they Ctrl-C.
  if (webServer) {
    stderr.write('wintail: snapshot ready — press Ctrl-C to exit\n');
    process.on('SIGINT', () => process.exit(130));
    return;
  }
  if (exitCode !== 0) process.exit(exitCode);
}

module.exports = { main, buildPipeline };
