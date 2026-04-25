'use strict';

const { spawnSync } = require('node:child_process');

const INSTALL_SCRIPT = `
$p = $PROFILE.CurrentUserAllHosts
if (-not (Test-Path $p)) { New-Item -ItemType File -Force -Path $p | Out-Null }
$line = 'Set-Alias tail wintail'
$existing = @(Get-Content -LiteralPath $p -ErrorAction SilentlyContinue)
if ($existing -contains $line) {
  Write-Host "  already configured: $p"
} else {
  Add-Content -LiteralPath $p -Value $line
  Write-Host "  added 'Set-Alias tail wintail' to $p"
}
`.trim();

const UNINSTALL_SCRIPT = `
$p = $PROFILE.CurrentUserAllHosts
$line = 'Set-Alias tail wintail'
if (-not (Test-Path $p)) { Write-Host "  no profile file at $p"; return }
$existing = @(Get-Content -LiteralPath $p -ErrorAction SilentlyContinue)
if ($existing -contains $line) {
  $remaining = $existing | Where-Object { $_ -ne $line }
  Set-Content -LiteralPath $p -Value $remaining
  Write-Host "  removed 'Set-Alias tail wintail' from $p"
} else {
  Write-Host "  alias not present in $p"
}
`.trim();

function runShell(cmd, script) {
  return spawnSync(cmd, ['-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
  });
}

function runForBothShells(script, stdout, stderr) {
  let touchedAny = false;
  for (const cmd of ['pwsh', 'powershell']) {
    const r = runShell(cmd, script);
    if (r.error) {
      if (r.error.code === 'ENOENT') continue;
      stderr.write(`wintail: ${cmd}: ${r.error.message}\n`);
      continue;
    }
    if (r.status !== 0) {
      stderr.write(`wintail: ${cmd} exited with status ${r.status}\n`);
      if (r.stderr) stderr.write(r.stderr);
      continue;
    }
    stdout.write(`${cmd}:\n`);
    if (r.stdout) stdout.write(r.stdout);
    touchedAny = true;
  }
  return touchedAny;
}

function installAlias(stdout = process.stdout, stderr = process.stderr) {
  if (process.platform !== 'win32') {
    stderr.write('wintail: --install-alias is Windows-only.\n');
    stderr.write('On macOS/Linux you already have tail. To make this CLI shadow it, add to ~/.bashrc:\n');
    stderr.write('  alias tail=wintail\n');
    return 1;
  }
  if (!runForBothShells(INSTALL_SCRIPT, stdout, stderr)) {
    stderr.write('wintail: neither pwsh nor powershell was found on PATH.\n');
    return 1;
  }
  stdout.write('Open a new PowerShell session to use `tail`.\n');
  return 0;
}

function uninstallAlias(stdout = process.stdout, stderr = process.stderr) {
  if (process.platform !== 'win32') {
    stderr.write('wintail: --uninstall-alias is Windows-only.\n');
    return 1;
  }
  if (!runForBothShells(UNINSTALL_SCRIPT, stdout, stderr)) {
    stderr.write('wintail: neither pwsh nor powershell was found on PATH.\n');
    return 1;
  }
  return 0;
}

module.exports = { installAlias, uninstallAlias };
