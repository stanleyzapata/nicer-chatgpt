const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-extension');

function area(seed = {}) {
  const data = { ...seed };
  return {
    data,
    async get(key) {
      if (typeof key === 'string') return { [key]: data[key] };
      return { ...data };
    },
    async set(value) { Object.assign(data, value); },
    async remove(key) { delete data[key]; }
  };
}

test('keeps preferences in sync storage and message records local', async () => {
  const { storage } = load('storage.js');
  const sync = area();
  const local = area();
  const store = storage.create({ sync, local });
  await store.setSettings({ format: '24', includeInPrompts: false });
  await store.mergeMessageRecord('chat-1', 'message-1', { startedAt: 10, finishedAt: 20, captureZone: 'UTC' });
  assert.equal(sync.data.settings.format, '24');
  assert.equal(local.data['conversation:chat-1'].messages['message-1'].finishedAt, 20);
  assert.equal(sync.data['conversation:chat-1'], undefined);
});

test('returns safe defaults and ignores corrupt records', async () => {
  const { storage } = load('storage.js');
  const sync = area({ settings: { schemaVersion: 99, format: 'bad' } });
  const local = area({ 'conversation:chat-1': { broken: true } });
  const store = storage.create({ sync, local });
  const settings = await store.getSettings();
  assert.equal(settings.format, 'auto');
  assert.equal(settings.enabled, true);
  assert.equal(await store.getMessageRecord('chat-1', 'message-1'), null);
});
