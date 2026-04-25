'use strict';

const { spawnSync } = require('node:child_process');

const PS_SCRIPT = `
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

function runShell(cmd) {
  return spawnSync(cmd, ['-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-Command', PS_SCRIPT], {
    encoding: 'utf8',
    windowsHide: true,
  });
}

function installAlias(stdout = process.stdout, stderr = process.stderr) {
  if (process.platform !== 'win32') {
    stderr.write('wintail: --install-alias is Windows-only.\n');
    stderr.write('On macOS/Linux you already have tail. To make this CLI shadow it, add to ~/.bashrc:\n');
    stderr.write('  alias tail=wintail\n');
    return 1;
  }

  let touchedAny = false;
  for (const cmd of ['pwsh', 'powershell']) {
    const r = runShell(cmd);
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

  if (!touchedAny) {
    stderr.write('wintail: neither pwsh nor powershell was found on PATH.\n');
    return 1;
  }
  stdout.write('Open a new PowerShell session to use `tail`.\n');
  return 0;
}

module.exports = { installAlias };
