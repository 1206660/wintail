# wintail

Linux-style `tail` for PowerShell and Windows. Zero dependencies. `npx`-installable.

PowerShell's built-in `Get-Content -Wait -Tail` is slow on big logs, doesn't follow log rotation, and feels nothing like `tail`. `wintail` is the `tail` you already know — `tail -f`, `tail -F`, `tail -n 100`, multi-file headers, all of it — running on Node.js with no native deps.

## Install

No install needed:

```powershell
# from npm (after publish)
npx wintail app.log

# directly from GitHub, no publish required
npx github:1206660/wintail app.log
```

Global install:

```powershell
npm install -g wintail
wintail app.log
```

Requires Node.js 18+.

## Make `tail` work in PowerShell

Once:

```powershell
wintail --install-alias
```

This appends `Set-Alias tail wintail` to your PowerShell `$PROFILE.CurrentUserAllHosts` (idempotent, runs for both `pwsh` and `powershell` if installed). Open a new shell and `tail file.log` works.

Prefer to add it manually:

```powershell
Add-Content $PROFILE.CurrentUserAllHosts 'Set-Alias tail wintail'
```

## Usage

```
wintail [OPTION]... [FILE]...
```

| Flag | Meaning |
|---|---|
| `-n N` / `--lines=N` | Last N lines (default 10) |
| `-n +N` | Print starting at line N (1-indexed) |
| `-c N` / `--bytes=N` | Last N bytes |
| `-c +N` | Starting at byte N |
| `-f` / `--follow` | Follow appended data (file descriptor) |
| `-F` | Follow by name; survives log rotation and truncation |
| `-q` / `--quiet` | Never print `==> FILE <==` headers |
| `-v` / `--verbose` | Always print headers |
| `-s SECS` | Polling interval for `-f` (default 1.0) |
| `--pid=PID` | With `-f`, exit when PID dies |
| `--encoding=ENC` | `utf8` (default), `utf16le`, `latin1`, `ascii`. UTF-8 / UTF-16 BOMs are auto-detected. |
| `--install-alias` | Add `Set-Alias tail wintail` to your PowerShell profile |
| `-h` / `--help` | Help |
| `-V` / `--version` | Version |

`N` accepts multipliers: `b` (512), `k` (1024), `K` (1024), `M` (1024²), `G` (1024³).

When `FILE` is `-` or omitted, reads stdin.

## Examples

```powershell
# Last 10 lines (default)
wintail app.log

# Last 50 lines
wintail -n 50 app.log

# From line 100 onward
wintail -n +100 app.log

# Last 1 KB
wintail -c 1k app.log

# Follow appends (Ctrl-C to stop)
wintail -f app.log

# Follow by name — survives rename/recreate (logrotate-style)
wintail -F app.log

# Multiple files, with headers
wintail a.log b.log

# From a pipe
Get-Content big.log | wintail -n 5

# Tail a UTF-16 LE log written by some Windows tools
wintail --encoding=utf16le myapp.log
```

## How `-f` and `-F` differ

- `-f` follows the open file descriptor. If the file is renamed or replaced, you keep tailing the renamed file (which usually stops growing). Same as GNU tail.
- `-F` follows the path. If the file is rotated (renamed + recreated, or deleted + recreated), wintail reopens the new file and prints `wintail: 'FILE' has been replaced; following new file` to stderr. This is the option you want for production logs.

Rotation detection on Windows uses a size+mtime heuristic (Node's `fs.Stats.ino` is always 0 on Windows, so the inode trick used on Linux doesn't work). It catches the common `logrotate`-style and `move + create` rotation patterns.

## Publishing to npm (maintainer notes)

```powershell
npm login
npm publish
```

`bin`, `files`, `engines`, and `repository` are already configured in `package.json`. `npx wintail` will work for everyone after publish.

## Development

```powershell
npm test          # runs tests with Node's built-in test runner
npm link          # makes `wintail` available globally for testing
```

## License

MIT
