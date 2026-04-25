const VERSION = require('../package.json').version;

const HELP_TEXT = `Usage: wintail [OPTION]... [FILE]...
Print the last 10 lines of each FILE to standard output.
With more than one FILE, precede each with a header giving the file name.
With no FILE, or when FILE is -, read standard input.

Mandatory arguments to long options are mandatory for short options too.

  -c, --bytes=[+]NUM       output the last NUM bytes; or use -c +NUM to
                             output starting with byte NUM of each file
  -f, --follow[={name|descriptor}]
                           output appended data as the file grows;
                             an absent option argument means 'descriptor'
  -F                       same as --follow=name --retry
  -n, --lines=[+]NUM       output the last NUM lines, instead of the last 10;
                             or use -n +NUM to output starting with line NUM
      --head=NUM           output the FIRST NUM lines (opposite of -n).
                             Wins over -n / -c when set.
      --pid=PID            with -f, terminate after process ID, PID dies
  -q, --quiet, --silent    never output headers giving file names
      --retry              keep trying to open a file if it is inaccessible
  -s, --sleep-interval=N   with -f, sleep for approximately N seconds
                             (default 1.0) between iterations
  -v, --verbose            always output headers giving file names
      --encoding=ENC       file encoding: utf8 (default), utf16le, latin1, ascii
      --install-alias      add 'Set-Alias tail wintail' to your PowerShell
                             \$PROFILE so 'tail' calls wintail (Windows only)
      --uninstall-alias    remove the line added by --install-alias
      --history            list the last 20 wintail invocations
      --resume[=N]         interactively pick from the last 5 unique commands
                           and re-run it. With =N, re-run that index directly
                           (1 = oldest, 5 = newest). Stored at
                           %LOCALAPPDATA%/wintail/history.jsonl on Windows or
                           ~/.wintail/history.jsonl elsewhere.
      --replay[=RATE]      replay each FILE at simulated tail-f speed using
                           parsed timestamps as the clock. RATE multiplies
                           speed (default 1; 2 = double speed; 0.5 = half).
                           Lines without timestamps fall back to a fixed gap.
                           Inter-line gaps capped at 5s to keep playback bearable.
      --watch=CMD          run shell command CMD periodically; pipe each
                           invocation's stdout through the pipeline.
                           Replaces FILE args. Combine with all transforms.
      --watch-interval=N   seconds between --watch runs (default 2)
      --completion=SHELL   print a tab-completion script. SHELL is one of
                           powershell, bash, or zsh.
                           Install: wintail --completion=powershell |
                                    Out-String | Invoke-Expression
      --config=FILE        load JSON config from FILE (overrides discovery)
      --no-config          ignore any auto-discovered .wintailrc
      --profile=NAME       select named profile from a profiled config

Auto-discovered config files (in priority order):
  ./.wintailrc, ./.wintailrc.json, ./wintail.config.json,
  ~/.wintailrc, ~/.wintailrc.json, ~/wintail.config.json
Each maps wintail flags to JSON keys (use shorthand: 'grep', 'highlight',
'pretty-json', etc.). CLI args still override config values. Profiled
format: { "default": {...}, "errors": {...}, "ue-debug": {...} }.
  -h, --help               display this help and exit
  -V, --version            output version information and exit

Filter & display (v0.2):
  -G, --grep=PATTERN       only show lines matching regex (repeatable; OR
                           by default, AND with --grep-and)
      --grep-and           require ALL --grep patterns to match (default OR)
      --grep-v=PATTERN     drop lines matching regex (repeatable)
      --include-from=FILE  load --grep patterns from FILE (one per line; lines
                           starting with # and blank lines are skipped)
      --exclude-from=FILE  load --grep-v patterns from FILE (same format)
  -i, --ignore-case        case-insensitive --grep / --grep-v
  -N, --line-number        prefix each line with its 1-based line number
      --color={auto,always,never}
                           color output. Default 'auto' (TTY + no NO_COLOR env)
      --no-color           same as --color=never
      --highlight=PAT=COLOR
                           wrap regex matches with ANSI color (repeatable).
                           COLOR: red,green,yellow,blue,magenta,cyan,white,
                           dim,bold (combine with space: 'red bold')
      --no-default-highlight  disable built-in ERROR/WARN/INFO/DEBUG colors
      --theme=NAME         color theme for built-in highlights. NAME:
                           default, dracula, solarized, monokai, nord,
                           github, high-contrast.
      --tag=PAT=LABEL      prepend [LABEL] to lines matching PAT (repeatable;
                           multiple matching tags chain). Each label gets a
                           deterministic color when --color is enabled.
      --rate-limit=N       cap output to N lines/sec per source. Excess lines
                           are dropped; on next-second roll, a summary
                           '[wintail: K lines dropped]' is printed.
      --every=N            sample 1 of every N lines (per source). 1 = pass
                           through (default).
      --exit-code-on-match=PAT[=CODE]
                           if any line matches PAT, exit with CODE (default 1)
                           when the run ends. Repeatable; first match wins.
                           Useful in CI: tail logs, fail build on Fatal.
      --notify-on=PAT[=TITLE]
                           fire a Windows toast when a line matches (repeatable,
                           throttled to 1/pattern/5s)
      --webhook=PAT=URL    POST to URL on regex match (repeatable, throttled
                           to 1/spec/5s). Auto-detects Slack / Discord /
                           generic format. ANSI codes stripped from payload.
      --pretty-json        if a line is valid JSON, pretty-print it (2-space)
      --since=SPEC         only show lines whose timestamp is >= SPEC.
                           SPEC: relative (5m, 30s, 2h, 1d), today HH:MM,
                           ISO 8601, UE format. Lines without a timestamp
                           inherit the previous line's (so stack traces stay).
      --until=SPEC         only show lines whose timestamp is <= SPEC
      --ue                 Unreal Engine log mode: color each Channel
                           deterministically; color Severity (Error red bold,
                           Warning yellow, Fatal magenta bold, Verbose dim);
                           dim ts/frame brackets. Indented lines (likely stack
                           continuations) are dimmed.
      --dir-glob=PATTERN   when a FILE arg is a directory, expand to files
                           matching PATTERN (default: *.log)
      --add-timestamp[=FMT]
                           prefix each line with current wall-clock time.
                           FMT: time (HH:MM:SS, default), iso, epoch, epoch-ms
      --truncate[=WIDTH]   truncate each line to WIDTH visible chars (default
                           = terminal width or 80) and append '…'. ANSI codes
                           don't count toward width.
      --max-lines=N        emit at most N lines (after all filters) then exit.
                           Useful with -f to capture a bounded live snapshot.
      --prefix=TEMPLATE    prefix every line with TEMPLATE. Substitutions:
                           {source} = file path, {time} = HH:MM:SS. Pairs
                           well with multi-file -f instead of headers.
                           Example: --prefix='[{source}] '
      --mark[=N]           with -f, every N seconds (default 60) print a
                           visual time separator to stderr. Aids orientation
                           in long live tails.
      --web=SPEC           expose live tail in a browser. SPEC is :PORT (binds
                           127.0.0.1) or HOST:PORT. Page has filter / pause /
                           autoscroll / clear. ANSI colors translated to HTML.
                           Server also serves GET /health (JSON status) and
                           GET /metrics (Prometheus text format with
                           wintail_lines_total, wintail_subscribers, etc.,
                           plus errors/warns/per-source when --stats is on).
      --web-token=TOKEN    require ?token=TOKEN to access. Mandatory when
                           --web binds to a non-loopback address. Also
                           required for /health and /metrics.
      --save=FILE          tee output to FILE in addition to stdout. ANSI
                           codes are stripped from the file. Overwrites.
      --save-append=FILE   like --save but appends to FILE if it exists.
      --strip-ansi         remove pre-existing ANSI escape codes from input
                           lines (runs first in the pipeline)
  -A, --show-nonprinting   replace control bytes with cat-style glyphs
                           (^M for CR, ^@ for NUL, ^? for DEL, \xNN otherwise).
                           Useful for spotting hidden chars in logs.
  -z, --null-data          treat NUL byte as the input line separator (output
                           still uses newline). Like grep -z.
      --squeeze-blank      collapse consecutive blank/whitespace-only lines
                           to a single blank line (per source)
      --plain              raw output: disable color, built-in highlights, and
                           terminal embellishments. Useful when piping wintail
                           into another tool.
      --collapse-repeats   suppress consecutive identical lines and emit a
                           '[wintail: previous line repeated N times]' summary
                           when the streak ends (per source)
      --stats[=N]          every N seconds (default 10) print to stderr a
                           summary: total lines, errors, warnings, recent
                           lines/sec, top files. Final summary on exit.
      --json-filter=EXPR   keep only JSONL lines that match EXPR (repeatable;
                           combined as AND). EXPR: key=val, key!=val, key>=N,
                           key>N, key<=N, key<N, key~regex, key!~regex, or
                           just 'key' to require existence. Dot-paths for
                           nested (user.role=admin). Non-JSON lines dropped.
      --json-keep-non-json with --json-filter / --json-extract, pass non-JSON
                           lines through unchanged
      --json-extract=SPEC  project JSON fields to a clean text line. SPEC is
                           either comma-separated paths ('level,msg,user.id')
                           which join values with spaces, OR a template with
                           {path} placeholders ('[{ts}] [{level}] {msg}').
      --regex-extract=PAT  apply regex; emit only the captured groups (joined
                           by space) per line. Lines that don't match are
                           dropped (override with --regex-extract-keep-non-match).
                           If pattern has no capture groups, emit the full
                           match. Honors --ignore-case.
      --regex-extract-keep-non-match
                           pass non-matching lines through unchanged

.gz files are auto-decompressed (read mode only; -f/-F rejected since gz
files do not grow).

NUM may have a multiplier suffix:
  b 512, k 1024, K 1024, M 1024*1024, G 1024*1024*1024.

Examples:
  wintail app.log                Last 10 lines of app.log
  wintail -n 50 app.log          Last 50 lines
  wintail -n +100 app.log        From line 100 to end
  wintail -c 1k app.log          Last 1024 bytes
  wintail -f app.log             Follow appends (Ctrl-C to stop)
  wintail -F app.log             Follow by name (survives log rotation)
  wintail a.log b.log            Multiple files with headers
  wintail *.log                  Glob (auto-expanded; ignored on PowerShell)
  Get-Content big.log | wintail  Tail from a pipe
  wintail -G ERROR -F app.log    Live tail, only ERROR lines
  wintail --grep-v noise -i app.log
                                 Drop noisy lines (case-insensitive)
  wintail --highlight 'panic=red bold' app.log
                                 Custom highlight on top of built-ins
  wintail --notify-on Fatal -F app.log
                                 Toast on Fatal (Windows)
  wintail --install-alias        Make 'tail' work in PowerShell

Project home: https://github.com/1206660/wintail
`;

const VERSION_TEXT = `wintail ${VERSION}
Linux-style tail for PowerShell/Windows. MIT licensed.
`;

module.exports = { HELP_TEXT, VERSION_TEXT, VERSION };
