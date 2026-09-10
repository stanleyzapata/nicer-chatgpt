const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-extension');

test('creates and parses only a final generated timestamp marker', () => {
  const { marker } = load('time.js', 'marker.js');
  const generated = marker.create({ epochMs: Date.parse('2026-09-10T19:42:18Z'), captureZone: 'America/Santo_Domingo' }, { format: '12', zone: 'America/Santo_Domingo' });
  assert.equal(generated, '[Sent: Sep 10, 2026, 3:42:18 PM AST; timezone: America/Santo_Domingo]');
  const parsed = marker.parse(`Hello\n\n${generated}`);
  assert.equal(parsed.zone, 'America/Santo_Domingo');
  assert.equal(parsed.marker, generated);
  assert.equal(marker.parse(`${generated}\nmore text`), null);
  const utc = marker.create({ epochMs: Date.parse('2026-09-10T19:42:18Z'), captureZone: 'America/Santo_Domingo', markerZone: 'UTC' }, { format: 'iso', zone: 'UTC' });
  assert.equal(utc, '[Sent: 2026-09-10T19:42:18Z; timezone: UTC]');
});

test('strips only the exact expected final marker', () => {
  const { marker } = load('time.js', 'marker.js');
  const expected = '[Sent: Sep 10, 2026, 3:42:18 PM AST; timezone: America/Santo_Domingo]';
  assert.equal(marker.strip(`Hello\n\n${expected}`, expected), 'Hello');
  assert.equal(marker.strip(`Hello\n${expected}`, '[Sent: different]'), `Hello\n${expected}`);
  assert.equal(marker.strip(`I wrote ${expected} intentionally`, expected), `I wrote ${expected} intentionally`);
});
