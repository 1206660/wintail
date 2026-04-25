# wintail

`tail` for PowerShell and Windows. Behaves like GNU `tail` but adds color, grep, JSON filtering, time-window slicing, Unreal Engine log mode, Windows toast notifications, and 25+ other flags. **Zero dependencies, single `npx` command.**

```powershell
npx github:1206660/wintail app.log              # last 10 lines
npx github:1206660/wintail -F -G ERROR app.log  # follow, only errors, in red
```

PowerShell's built-in `Get-Content -Wait -Tail` is slow on big logs, doesn't follow log rotation, and lacks every feature you reach for from real `tail`. `wintail` is the `tail` you already know — `tail -f`, `tail -F`, `tail -n 100`, multi-file headers — and then 30+ more flags for live log reading.

---

## Install

```powershell
# zero-install (recommended for one-off use)
npx github:1206660/wintail app.log

# global install
npm install -g wintail
wintail app.log

# in PowerShell, make `tail` work like Linux:
wintail --install-alias
# (then open a new shell — `tail file.log` now calls wintail)
```

Requires **Node.js ≥ 18**. Node 22+ for glob expansion of `*.log` style args.

---

## What it does

### GNU tail compatibility (the basics)

| | |
|---|---|
| `wintail file` | Last 10 lines |
| `wintail -n 50 file` | Last 50 lines |
| `wintail -n +100 file` | From line 100 to end |
| `wintail -c 1k file` | Last 1024 bytes |
| `wintail -f file` | Follow appends (Ctrl-C to stop) |
| `wintail -F file` | Follow by name — survives log rotation |
| `wintail a.log b.log` | Multi-file with `==> name <==` headers |
| `Get-Content big.log \| wintail -n 5` | From a pipe |
| `wintail --pid 1234 -f file` | Stop following when PID dies |
| `wintail -s 0.5 -f file` | Polling interval (default 1s) |
| `wintail --encoding=utf16le file` | UTF-16LE input (BOMs auto-detected) |

### Color & highlighting

| | |
|---|---|
| `--color={auto,always,never}` | Default `auto` (TTY + no `NO_COLOR`) |
| Built-in highlights | `ERROR`/`Fatal`/`panic` red bold, `WARN` yellow, `INFO` cyan, `DEBUG`/`Verbose` dim |
| `--highlight=PAT=COLOR` | Custom highlight (repeatable). `'panic=red bold'`, `'TODO=yellow'` |
| `--no-default-highlight` | Disable built-ins |
| `--no-color` / `--color=never` | Strip all colors |

### Filter

| | |
|---|---|
| `-G PAT` / `--grep=PAT` | Keep matching lines (repeatable, OR by default) |
| `--grep-and` | Require ALL `--grep` patterns to match (AND) |
| `--grep-v=PAT` | Drop matching lines (repeatable) |
| `-i` / `--ignore-case` | Case-insensitive grep |
| `--include-from=FILE` | Load `--grep` patterns from file (one per line, `#` for comments) |
| `--exclude-from=FILE` | Same, for `--grep-v` |
| `--since=SPEC` | Drop lines older than SPEC. `5m`, `1h`, `2d`, `10:30`, ISO 8601, UE `[YYYY.MM.DD-HH.MM.SS:ms]`. Multi-line stack traces inherit the previous line's timestamp. |
| `--until=SPEC` | Drop lines newer than SPEC. Combine for windows. |

### Transform

| | |
|---|---|
| `-N` / `--line-number` | Prefix `123\t` (per source) |
| `--prefix=TEMPLATE` | Prefix every line. `{source}` `{time}` substitutions. |
| `--add-timestamp[=FMT]` | Wall-clock time prefix. FMT: `time` (HH:MM:SS), `iso`, `epoch`, `epoch-ms` |
| `--strip-ansi` | Remove existing escape codes from input |
| `--collapse-repeats` | Suppress consecutive duplicates with `[wintail: previous line repeated N times]` summary |
| `--truncate[=N]` | Truncate to N visible chars (default = terminal width) with `…`. ANSI-aware. |
| `--regex-extract=PAT` | Emit only captured groups (or full match if no groups). Drops non-matching lines. |
| `--regex-extract-keep-non-match` | Pass through non-matches |
| `--max-lines=N` | Emit at most N lines (post-filter) then exit |

### JSONL logs

| | |
|---|---|
| `--pretty-json` | Detect JSON lines and pretty-print with 2-space indent |
| `--json-filter=EXPR` | Keep matching JSON lines. EXPR: `key=val`, `key!=val`, `key>=N`, `key>N`, `key<=N`, `key<N`, `key~regex`, `key!~regex`, or just `key` to require existence. Dot-paths: `user.role=admin`. Repeatable (AND). |
| `--json-extract=SPEC` | Project to clean text. Either comma paths (`level,msg,user.id`) or template (`'[{ts}] [{level}] {msg}'`) |
| `--json-keep-non-json` | Don't drop non-JSON lines |

### Unreal Engine

| | |
|---|---|
| `--ue` | UE log mode: parse `[ts][frame]Channel: [Severity: ]Message`. Color each Channel deterministically (12-color palette via stable hash). Severity: Error red bold, Fatal magenta bold, Warning yellow, Verbose dim. Indented continuation lines (stack frames) dimmed. |

Combine with everything: `wintail -F --ue -G LogTemp Saved/Logs/MyGame.log`

### Output / capture

| | |
|---|---|
| `--save=FILE` | Tee output to FILE (ANSI stripped by default) |
| `--save-append=FILE` | Same but append to existing file |
| `--stats[=N]` | Every N seconds (default 10), print to stderr: total lines, errors, warnings, recent + average lines/sec, top 3 files. Final summary on exit. |
| `--mark[=N]` | With `-f`, periodic visual time separator to stderr (default every 60s). Aids orientation in long tails. |

### Files & glob

| | |
|---|---|
| `wintail *.log` | Glob auto-expanded (Node 22+ `fs.globSync`) |
| `wintail dir/` | Directory expands to its `*.log` files |
| `--dir-glob=PATTERN` | Customize directory expansion (default `*.log`) |
| `wintail rotated.log.gz` | `.gz` files auto-decompressed (read mode only) |

### Notifications

| | |
|---|---|
| `--notify-on=PAT[=TITLE]` | Windows toast on match. Repeatable. Throttled to 1 per pattern per 5s. Non-Windows: silent no-op + 1 startup warning. |

### PowerShell convenience

| | |
|---|---|
| `--install-alias` | Add `Set-Alias tail wintail` to your `$PROFILE.CurrentUserAllHosts`. Idempotent, runs for both `pwsh` and `powershell`. |
| `--uninstall-alias` | Remove the line added above |

---

## Real-world recipes

```powershell
# Live tail of an Unreal project, only the bits you care about, with toast on Fatal:
wintail -F --ue -G "Error|Warning" --notify-on Fatal D:\MyGame\Saved\Logs\MyGame.log

# Tail every log file in a UE project's log directory:
wintail -F D:\MyGame\Saved\Logs\

# JSON service log: filter to your service's errors and project to a clean view:
wintail -F app.log --json-filter level=error --json-filter service=billing \
  --json-extract '[{ts}] {level} {msg}'

# Capture last 100 errors from a noisy live log to a file:
wintail -F -G ERROR --max-lines 100 --save errors.txt app.log

# Long-running watch with periodic time separators and stats:
wintail -F --mark=30 --stats=60 --highlight 'panic=red bold' app.log

# Tail a rotated gzipped log:
wintail rotated.log.1.gz | wintail -G CRITICAL  # (or just use --grep directly)

# Multi-file follow with custom prefixes (interleaves cleanly without headers):
wintail -F --prefix='[{source}] ' -q a.log b.log c.log
```

---

## How `-f` and `-F` differ

- `-f` follows the open file descriptor. If the file is renamed or replaced, you keep tailing the renamed file (which usually stops growing). Same as GNU tail.
- `-F` follows the **path**. If the file is rotated (renamed + recreated, or deleted + recreated), wintail reopens the new file and prints `wintail: 'FILE' has been replaced; following new file` to stderr.

Rotation detection on Windows uses a size+mtime heuristic (Node's `fs.Stats.ino` is always 0 on Windows, so the inode trick used on Linux doesn't work). It catches the common `logrotate`-style and `move + create` rotation patterns.

---

## Why not just use `Get-Content -Wait`?

PowerShell's built-in is fine for occasional small files. For real log work it's frustrating:

- Slow on big files — adds NoteProperty overhead per line
- Doesn't survive log rotation
- No coloring, no grep, no JSON filter, no toast
- Verbose syntax (`Get-Content app.log -Wait -Tail 50`)

`wintail -F app.log` is shorter, faster, and survives the things real logs do.

---

## Stats

273 unit tests. Zero runtime deps. ~2,000 LOC. ~30 user-facing flags.

---

## Publishing to npm

```powershell
npm login
npm publish
```

`bin`, `files`, `engines`, and `repository` are pre-configured.

---

## License

MIT
