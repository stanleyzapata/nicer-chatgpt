const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-extension');

test('resolves current, original, UTC, and custom timezone modes', () => {
  const { time } = load('time.js');
  assert.equal(time.resolveZone({ displayZoneMode: 'current' }, null, 'America/Santo_Domingo'), 'America/Santo_Domingo');
  assert.equal(time.resolveZone({ displayZoneMode: 'original' }, 'Europe/Madrid', 'America/Santo_Domingo'), 'Europe/Madrid');
  assert.equal(time.resolveZone({ displayZoneMode: 'utc' }, null, 'America/Santo_Domingo'), 'UTC');
  assert.equal(time.resolveZone({ displayZoneMode: 'custom', customZone: 'Asia/Tokyo' }, null, 'America/Santo_Domingo'), 'Asia/Tokyo');
  assert.equal(time.resolveZone({ displayZoneMode: 'custom', customZone: 'Invalid/Zone' }, null, 'America/Santo_Domingo'), 'America/Santo_Domingo');
});

test('formats 12-hour, 24-hour, and ISO timestamps with seconds', () => {
  const { time } = load('time.js');
  const epoch = Date.parse('2026-09-10T19:42:18Z');
  assert.match(time.format(epoch, { format: '12', zone: 'America/Santo_Domingo' }), /Sep 10, 2026, 3:42:18 PM/);
  assert.match(time.format(epoch, { format: '24', zone: 'America/Santo_Domingo' }), /10 Sep 2026, 15:42:18/);
  assert.equal(time.format(epoch, { format: 'iso', zone: 'America/Santo_Domingo' }), '2026-09-10T15:42:18-04:00');
  assert.equal(time.format(epoch, { format: 'iso', zone: 'UTC' }), '2026-09-10T19:42:18Z');
});

test('handles a date boundary in the selected timezone', () => {
  const { time } = load('time.js');
  const epoch = Date.parse('2026-09-11T02:15:00Z');
  assert.equal(time.format(epoch, { format: 'iso', zone: 'America/Santo_Domingo' }), '2026-09-10T22:15:00-04:00');
});
