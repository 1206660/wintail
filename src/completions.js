'use strict';

// Single source of truth for flag completions.
// Long form flags with optional descriptions for zsh.
const FLAGS = [
  // GNU tail core
  ['-n',  'output the last N lines'],
  ['-c',  'output the last N bytes'],
  ['-f',  'follow appends'],
  ['-F',  'follow by name (survives rotation)'],
  ['-q',  'never print headers'],
  ['-v',  'always print headers'],
  ['-s',  'sleep interval for -f'],
  ['-h',  'help'],
  ['-V',  'version'],
  ['--lines',          'output the last N lines'],
  ['--bytes',          'output the last N bytes'],
  ['--follow',         'follow appends'],
  ['--retry',          'keep retrying open'],
  ['--quiet',          'never print headers'],
  ['--silent',         'never print headers'],
  ['--verbose',        'always print headers'],
  ['--sleep-interval', 'polling interval seconds'],
  ['--pid',            'exit when PID dies'],
  ['--encoding',       'utf8 / utf16le / latin1 / ascii'],
  ['--help',           'show help'],
  ['--version',        'show version'],

  // Filter & display
  ['-G',  'grep regex'],
  ['-N',  'line number prefix'],
  ['-i',  'case-insensitive grep'],
  ['--grep',          'only show matching lines'],
  ['--grep-and',      'AND-mode multi-pattern grep'],
  ['--grep-v',        'drop matching lines'],
  ['--ignore-case',   'case-insensitive'],
  ['--line-number',   'prefix each line with its number'],
  ['--include-from',  'load grep patterns from file'],
  ['--exclude-from',  'load grep-v patterns from file'],
  ['--color',         'auto / always / never'],
  ['--no-color',      'disable color'],
  ['--highlight',     'PATTERN=COLOR'],
  ['--no-default-highlight', 'disable built-in highlights'],
  ['--max-lines',     'cap output then exit'],
  ['--prefix',        'prefix every line with TEMPLATE'],
  ['--add-timestamp', 'prefix wall-clock time'],
  ['--strip-ansi',    'remove escape codes from input'],
  ['--collapse-repeats', 'suppress consecutive duplicates'],
  ['--truncate',      'truncate to N visible chars'],
  ['--regex-extract', 'emit only captured groups'],
  ['--regex-extract-keep-non-match', 'pass through non-matches'],

  // Time window
  ['--since',  'only lines newer than SPEC'],
  ['--until',  'only lines older than SPEC'],

  // UE / JSON
  ['--ue',           'UE log channel/severity coloring'],
  ['--pretty-json',  'pretty-print JSON lines'],
  ['--json-filter',  'filter JSONL by key=val expr'],
  ['--json-extract', 'project JSON fields to text'],
  ['--json-keep-non-json', 'pass non-JSON lines through'],

  // Files
  ['--dir-glob',     'pattern when FILE is a directory'],

  // Output / capture
  ['--save',          'tee output to FILE (ANSI stripped)'],
  ['--save-append',   'append-mode --save'],
  ['--stats',         'periodic counters to stderr'],
  ['--mark',          'periodic time separators to stderr'],
  ['--notify-on',     'Windows toast on regex match'],

  // Web
  ['--web',          'expose live tail in a browser'],
  ['--web-token',    'require token to access --web'],

  // Meta
  ['--install-alias',   'add Set-Alias tail wintail to PowerShell profile'],
  ['--uninstall-alias', 'remove the tail alias'],
  ['--history',         'show last 20 invocations'],
  ['--resume',          'pick from recent commands and re-run'],
  ['--completion',      'print shell completion script (powershell|bash|zsh)'],
];

function flagsOnly() {
  return FLAGS.map(([f]) => f);
}

function powershellScript() {
  const flagList = flagsOnly().map(f => `'${f}'`).join(', ');
  return `# wintail · PowerShell tab completion
# Install: wintail --completion=powershell | Out-String | Invoke-Expression
# Persist: append the output to $PROFILE.CurrentUserAllHosts
Register-ArgumentCompleter -Native -CommandName wintail -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)
    $flags = @(${flagList})
    $flags | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
        [System.Management.Automation.CompletionResult]::new(
            $_, $_, 'ParameterName', $_
        )
    }
}
`;
}

function bashScript() {
  const flagList = flagsOnly().join(' ');
  return `# wintail · bash tab completion
# Install: source <(wintail --completion=bash)
# Persist: append the output to ~/.bashrc
_wintail_complete() {
    local cur="\${COMP_WORDS[COMP_CWORD]}"
    local prev="\${COMP_WORDS[COMP_CWORD-1]}"
    local flags="${flagList}"
    case "$prev" in
        --color)    COMPREPLY=( $(compgen -W "auto always never" -- "$cur") ); return ;;
        --encoding) COMPREPLY=( $(compgen -W "utf8 utf16le latin1 ascii" -- "$cur") ); return ;;
        --add-timestamp) COMPREPLY=( $(compgen -W "time iso epoch epoch-ms" -- "$cur") ); return ;;
        --completion)    COMPREPLY=( $(compgen -W "powershell bash zsh" -- "$cur") ); return ;;
        --include-from|--exclude-from|--save|--save-append)
            COMPREPLY=( $(compgen -f -- "$cur") ); return ;;
    esac
    if [[ "$cur" == -* ]]; then
        COMPREPLY=( $(compgen -W "$flags" -- "$cur") )
    else
        COMPREPLY=( $(compgen -f -- "$cur") )
    fi
}
complete -F _wintail_complete wintail
`;
}

function zshScript() {
  const args = FLAGS.map(([f, desc]) => {
    const safeDesc = (desc || '').replace(/'/g, "''").replace(/[\[\]]/g, '');
    return `    '${f}[${safeDesc}]'`;
  }).join(' \\\n');
  return `# wintail · zsh tab completion
# Install: source <(wintail --completion=zsh)
# Persist: append the output to ~/.zshrc (or save in fpath as _wintail)
_wintail() {
  _arguments \\
${args} \\
    '*:file:_files'
}
compdef _wintail wintail
`;
}

function generate(shell) {
  switch (shell) {
    case 'powershell': case 'pwsh': case 'posh': return powershellScript();
    case 'bash':                                  return bashScript();
    case 'zsh':                                   return zshScript();
    default:
      throw new Error(`unsupported shell: ${shell} (expected powershell|bash|zsh)`);
  }
}

module.exports = { generate, FLAGS, flagsOnly, powershellScript, bashScript, zshScript };
