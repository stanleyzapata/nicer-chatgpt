const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const popup = path.resolve(__dirname, '..', 'popup');

test('popup exposes the approved settings and export actions', () => {
  const html = fs.readFileSync(path.join(popup, 'popup.html'), 'utf8');
  for (const label of ['Show timestamps', 'Add timestamp to prompts', 'Display timezone', 'Time format', 'Markdown', 'JSON', 'Copy diagnostics']) assert.match(html, new RegExp(label));
  assert.doesNotMatch(html, /Received time/);
  assert.match(html, /aria-live/);
});
