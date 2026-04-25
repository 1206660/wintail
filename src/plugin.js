'use strict';

const path = require('node:path');

function loadPlugin(filePath) {
  const abs = path.resolve(filePath);
  let mod;
  try { mod = require(abs); }
  catch (e) {
    throw new Error(`--plugin: cannot load '${filePath}': ${e.message}`);
  }
  // 1) function ⇒ single transform
  if (typeof mod === 'function') return [mod];
  // 2) array of functions ⇒ multiple transforms
  if (Array.isArray(mod)) {
    if (mod.every((f) => typeof f === 'function')) return mod;
    throw new Error(`--plugin '${filePath}': array must contain only functions`);
  }
  // 3) object ⇒ { transform } or { transforms: [...] }
  if (mod && typeof mod === 'object') {
    if (typeof mod.transform === 'function') return [mod.transform];
    if (Array.isArray(mod.transforms) && mod.transforms.every((f) => typeof f === 'function')) {
      return mod.transforms;
    }
  }
  throw new Error(
    `--plugin '${filePath}': must export a function, an array of functions, or an object with .transform / .transforms`,
  );
}

function loadPlugins(pluginPaths) {
  if (!pluginPaths || pluginPaths.length === 0) return [];
  const all = [];
  for (const p of pluginPaths) all.push(...loadPlugin(p));
  return all;
}

module.exports = { loadPlugin, loadPlugins };
