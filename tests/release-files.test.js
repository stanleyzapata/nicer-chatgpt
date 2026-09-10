const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('tracks every icon required by the release package', () => {
  const root = path.resolve(__dirname, '..');
  const tracked = new Set(execFileSync('git', ['ls-files', 'icons'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean));
  for (const icon of ['icons/icon-16.png', 'icons/icon-32.png', 'icons/icon-48.png', 'icons/icon-128.png', 'icons/icon.svg']) {
    assert.ok(tracked.has(icon), `${icon} must be committed for GitHub release packaging`);
  }
});
