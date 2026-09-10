const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-extension');

test('reports working, paused, and needs-attention without content', () => {
  const { compatibility } = load('compatibility.js');
  assert.equal(compatibility.evaluate({ supported: true, enabled: true }).state, 'working');
  assert.equal(compatibility.evaluate({ supported: true, enabled: false }).state, 'paused');
  const result = compatibility.evaluate({ supported: false, enabled: true, missing: ['composer'], draft: 'secret' });
  assert.equal(result.state, 'attention');
  assert.deepEqual(result.diagnostics.missing, ['composer']);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});
