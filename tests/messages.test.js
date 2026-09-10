const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-extension');

test('records both assistant start and finish and derives duration', () => {
  const { messages } = load('messages.js');
  const lifecycle = messages.createLifecycle();
  lifecycle.started('m1', 1000, 'UTC');
  lifecycle.finished('m1', 1750, 'UTC', 'received');
  assert.deepEqual(lifecycle.get('m1'), {
    startedAt: 1000, startedZone: 'UTC', finishedAt: 1750, finishedZone: 'UTC', terminalKind: 'received'
  });
  assert.equal(messages.duration(lifecycle.get('m1')), 750);
});

test('formats response durations compactly for inline display', () => {
  const { messages } = load('messages.js');
  assert.equal(messages.formatDuration(6200), '6.2s');
  assert.equal(messages.formatDuration(72000), '1m 12s');
  assert.equal(messages.formatDuration(3720000), '1h 2m');
  assert.equal(messages.formatDuration(null), null);
});
