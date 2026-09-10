const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-extension');

function fixture({ replaceWorks = true, failFirstReplace = false, sendWorks = true } = {}) {
  let draft = 'Plan tomorrow';
  let sent = 0;
  let replacements = 0;
  let failureActions;
  const adapter = {
    getDraftText: () => draft,
    replaceDraftText: async (value) => { replacements += 1; if (replaceWorks && !(failFirstReplace && replacements === 1)) draft = value; },
    triggerSend: () => { if (!sendWorks) throw new Error('native-send-failed'); sent += 1; },
  };
  const presenter = { showFailure: (actions) => { failureActions = actions; }, clearFailure() {} };
  return { adapter, presenter, setDraft(value) { draft = value; }, get draft() { return draft; }, get sent() { return sent; }, get failureActions() { return failureActions; } };
}

test('verifies a timestamp before triggering native submission once', async () => {
  const TS = load('time.js', 'marker.js', 'submission.js');
  const f = fixture();
  const controller = TS.submission.createController({
    adapter: f.adapter, presenter: f.presenter, clock: () => Date.parse('2026-09-10T19:42:18Z'),
    getSettings: async () => ({ enabled: true, includeInPrompts: true, format: '12', displayZoneMode: 'current' }),
    detectedZone: () => 'America/Santo_Domingo'
  });
  assert.equal(await controller.submit(), true);
  assert.match(f.draft, /\[Sent: Sep 10, 2026, 3:42:18 PM AST;/);
  assert.equal(f.sent, 1);
});

test('preserves the draft and offers retry or bypass when verification fails', async () => {
  const TS = load('time.js', 'marker.js', 'submission.js');
  const f = fixture({ failFirstReplace: true });
  const controller = TS.submission.createController({
    adapter: f.adapter, presenter: f.presenter, clock: () => 1000,
    getSettings: async () => ({ enabled: true, includeInPrompts: true, format: 'iso', displayZoneMode: 'utc' }),
    detectedZone: () => 'UTC'
  });
  assert.equal(await controller.submit(), false);
  assert.equal(f.draft, 'Plan tomorrow');
  assert.equal(f.sent, 0);
  assert.equal(typeof f.failureActions.retry, 'function');
  await f.failureActions.sendWithoutTimestamp();
  assert.equal(f.sent, 1);
  assert.equal(f.draft, 'Plan tomorrow');
});

test('strips a generated marker when edit mode opens', () => {
  const TS = load('time.js', 'marker.js', 'submission.js');
  const suffix = '[Sent: Sep 10, 2026, 3:42:18 PM AST; timezone: America/Santo_Domingo]';
  assert.equal(TS.submission.cleanEditedText(`Plan tomorrow\n\n${suffix}`), 'Plan tomorrow');
  assert.equal(TS.submission.cleanEditedText('Plan tomorrow'), 'Plan tomorrow');
});

test('clears the one-shot bypass if native submission fails', async () => {
  const TS = load('time.js', 'marker.js', 'submission.js');
  const f = fixture({ sendWorks: false });
  const controller = TS.submission.createController({
    adapter: f.adapter, presenter: f.presenter, clock: () => 1000,
    getSettings: async () => ({ enabled: true, includeInPrompts: true, format: 'iso', displayZoneMode: 'utc' }),
    detectedZone: () => 'UTC'
  });
  assert.equal(await controller.submit(), false);
  assert.equal(controller.consumeBypass(), false);
  assert.equal(f.draft, 'Plan tomorrow');
  assert.equal(typeof f.failureActions.retry, 'function');
});

test('timestamps the initiating edit field without changing the main composer', async () => {
  const TS = load('time.js', 'marker.js', 'submission.js');
  const main = { value: 'Unrelated main draft' };
  const edit = { value: 'Revised message' };
  const sendControl = {};
  let submitted;
  const adapter = {
    getDraftText: (field = main) => field.value,
    replaceDraftText: async (value, field = main) => { field.value = value; },
    triggerSend: (field, control) => { submitted = { field, control }; }
  };
  const controller = TS.submission.createController({
    adapter, presenter: { clearFailure() {}, showFailure() {} }, clock: () => Date.parse('2026-09-10T19:42:18Z'),
    getSettings: async () => ({ enabled: true, includeInPrompts: true, format: '12', displayZoneMode: 'current' }),
    detectedZone: () => 'America/Santo_Domingo'
  });
  assert.equal(await controller.submit({ field: edit, sendControl }), true);
  assert.equal(main.value, 'Unrelated main draft');
  assert.match(edit.value, /^Revised message\n\n\[Sent:/);
  assert.deepEqual(submitted, { field: edit, control: sendControl });
});

test('send without timestamp preserves text typed after the failure', async () => {
  const TS = load('time.js', 'marker.js', 'submission.js');
  const f = fixture({ failFirstReplace: true });
  const controller = TS.submission.createController({
    adapter: f.adapter, presenter: f.presenter, clock: () => 1000,
    getSettings: async () => ({ enabled: true, includeInPrompts: true, format: 'iso', displayZoneMode: 'utc' }),
    detectedZone: () => 'UTC'
  });
  await controller.submit();
  f.setDraft('Plan tomorrow, with my new note');
  await f.failureActions.sendWithoutTimestamp();
  assert.equal(f.draft, 'Plan tomorrow, with my new note');
  assert.equal(f.sent, 1);
});
