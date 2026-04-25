'use strict';

function compileSpec(spec) {
  if (typeof spec !== 'string' || spec.length === 0) {
    throw new Error('--exit-code-on-match: empty spec');
  }
  // PATTERN[=CODE]; if =CODE missing, default to 1
  let pattern = spec;
  let code = 1;
  // last '=N' where N is integer 1..255
  const m = spec.match(/^(.+)=(\d{1,3})$/);
  if (m) {
    const c = parseInt(m[2], 10);
    if (Number.isFinite(c) && c >= 0 && c <= 255) {
      pattern = m[1];
      code = c;
    }
  }
  let regex;
  try { regex = new RegExp(pattern); }
  catch (e) { throw new Error(`--exit-code-on-match invalid regex '${pattern}': ${e.message}`); }
  return { regex, code, pattern };
}

function makeExitCodeWatcher(specs) {
  if (!specs || specs.length === 0) {
    return { transform: (line) => line, getMatched: () => null };
  }
  const compiled = specs.map(compileSpec);
  let firstMatch = null;
  return {
    transform(line) {
      if (firstMatch === null) {
        for (const c of compiled) {
          if (c.regex.test(line)) {
            firstMatch = c;
            break;
          }
        }
      }
      return line;
    },
    getMatched: () => firstMatch,
    getExitCode: () => firstMatch ? firstMatch.code : 0,
  };
}

module.exports = { makeExitCodeWatcher, compileSpec };
