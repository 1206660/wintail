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
      --pid=PID            with -f, terminate after process ID, PID dies
  -q, --quiet, --silent    never output headers giving file names
      --retry              keep trying to open a file if it is inaccessible
  -s, --sleep-interval=N   with -f, sleep for approximately N seconds
                             (default 1.0) between iterations
  -v, --verbose            always output headers giving file names
      --encoding=ENC       file encoding: utf8 (default), utf16le, latin1, ascii
      --install-alias      add 'Set-Alias tail wintail' to your PowerShell
                             \$PROFILE so 'tail' calls wintail (Windows only)
  -h, --help               display this help and exit
  -V, --version            output version information and exit

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
  Get-Content big.log | wintail  Tail from a pipe
  wintail --install-alias        Make 'tail' work in PowerShell

Project home: https://github.com/1206660/wintail
`;

const VERSION_TEXT = `wintail ${VERSION}
Linux-style tail for PowerShell/Windows. MIT licensed.
`;

module.exports = { HELP_TEXT, VERSION_TEXT, VERSION };
