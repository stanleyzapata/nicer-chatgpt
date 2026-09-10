const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-extension');

const snapshot = {
  title: 'Trip / planning', conversationId: 'abc', exportedAt: 2000,
  messages: [
    { id: 'u1', role: 'user', text: 'When?', sentAt: 1000, captureZone: 'UTC', source: 'local' },
    { id: 'a1', role: 'assistant', text: 'Tomorrow.', startedAt: 1200, finishedAt: 1800, captureZone: 'UTC', source: 'local' },
    { id: 'a2', role: 'assistant', text: 'Older.', createdAt: null, source: null },
    { id: 'u2', role: 'user', text: 'Recovered prompt', sentDisplay: 'Sep 10, 2026, 3:42:18 PM AST', captureZone: 'America/Santo_Domingo', source: 'marker' }
  ]
};

test('exports timestamped Markdown without fabricating unknown times', () => {
  const { exporter } = load('time.js', 'export.js');
  const value = exporter.toMarkdown(snapshot, { format: 'iso', zone: 'UTC' });
  assert.match(value, /## User/);
  assert.match(value, /Sent: 1970-01-01T00:00:01Z/);
  assert.match(value, /Exported: 1970-01-01T00:00:02Z/);
  assert.match(value, /Sent: Sep 10, 2026, 3:42:18 PM AST/);
  assert.match(value, /Duration: 0.6 seconds/);
  assert.match(value, /Older\./);
  assert.doesNotMatch(value, /Older\.\n\nCreated:/);
});

test('exports a versioned JSON schema with both assistant times', () => {
  const { exporter } = load('time.js', 'export.js');
  const parsed = JSON.parse(exporter.toJson(snapshot, { format: 'iso', zone: 'UTC' }));
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.messages[1].timestamps.startedAt, 1200);
  assert.equal(parsed.messages[1].timestamps.finishedAt, 1800);
  assert.equal(parsed.messages[1].timestamps.durationMs, 600);
  assert.equal(parsed.messages[1].display.finished, '1970-01-01T00:00:01Z');
  assert.equal(parsed.messages[2].timestamps.createdAt, null);
  assert.equal(parsed.messages[3].display.sent, 'Sep 10, 2026, 3:42:18 PM AST');
  assert.equal(exporter.filename(snapshot.title, 'md', 0), 'trip-planning-1970-01-01.md');
});

test('exports each assistant event in its captured timezone in Message timezone mode', () => {
  const { exporter } = load('time.js', 'export.js');
  const reply = {
    title: 'Timezone crossing',
    messages: [{
      id: 'a1', role: 'assistant', text: 'A reply.',
      startedAt: Date.UTC(2026, 8, 10, 15, 42, 19), startedZone: 'America/Santo_Domingo',
      finishedAt: Date.UTC(2026, 8, 10, 15, 42, 25), finishedZone: 'Europe/Madrid'
    }]
  };
  const settings = { format: 'iso', zone: 'UTC', displayZoneMode: 'original' };

  const markdown = exporter.toMarkdown(reply, settings);
  const json = JSON.parse(exporter.toJson(reply, settings));

  assert.match(markdown, /Started: 2026-09-10T11:42:19-04:00/);
  assert.match(markdown, /Received: 2026-09-10T17:42:25\+02:00/);
  assert.equal(json.messages[0].display.started, '2026-09-10T11:42:19-04:00');
  assert.equal(json.messages[0].display.finished, '2026-09-10T17:42:25+02:00');
});
