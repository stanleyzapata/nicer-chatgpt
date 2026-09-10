const path = require('node:path');

function load(...files) {
  delete globalThis.ChatGPTTimestamps;
  const all = ['namespace.js', ...files];
  for (const file of all) {
    const resolved = path.resolve(__dirname, '..', 'src', file);
    delete require.cache[resolved];
    require(resolved);
  }
  return globalThis.ChatGPTTimestamps;
}

module.exports = { load };
