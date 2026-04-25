'use strict';

// Each theme defines codes for the four built-in highlight severities.
// Code strings are passed to the ANSI wrapper as-is (e.g. '1;31' = bold red).
const THEMES = {
  default: {
    error: '1;31', warn: '33',  info: '36', debug: '2',
  },
  dracula: {
    error: '1;91', warn: '93',  info: '96', debug: '2;95',
  },
  solarized: {
    error: '31',   warn: '33',  info: '36', debug: '37;2',
  },
  monokai: {
    error: '1;31', warn: '33',  info: '95', debug: '2;37',
  },
  nord: {
    error: '1;31', warn: '93',  info: '94', debug: '2;36',
  },
  github: {
    error: '31',   warn: '33',  info: '34', debug: '2;37',
  },
  // High-contrast variant for projectors / accessibility
  'high-contrast': {
    error: '1;97;41', warn: '1;30;43', info: '1;97;44', debug: '1;30;47',
  },
};

function getTheme(name) {
  if (!(name in THEMES)) {
    const known = Object.keys(THEMES).join(', ');
    throw new Error(`unknown theme: ${name} (known: ${known})`);
  }
  return THEMES[name];
}

function listThemes() {
  return Object.keys(THEMES);
}

module.exports = { THEMES, getTheme, listThemes };
