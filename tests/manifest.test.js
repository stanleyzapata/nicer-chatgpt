const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('manifest is MV3, narrowly scoped, and references existing local files', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(packageJson.version, manifest.version, 'release source versions must match');
  assert.equal(manifest.name, 'Nicer ChatGPT');
  assert.equal(manifest.action.default_title, 'Nicer ChatGPT');
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.host_permissions, undefined);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://chatgpt.com/*']);
  for (const file of [...manifest.content_scripts[0].js, ...manifest.content_scripts[0].css, manifest.action.default_popup]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `Missing ${file}`);
  }
});

test('runtime source contains no external requests, telemetry, or unsafe HTML writes', () => {
  const files = fs.readdirSync(path.join(root, 'src')).filter((file) => file.endsWith('.js'));
  const source = files.map((file) => fs.readFileSync(path.join(root, 'src', file), 'utf8')).join('\n');
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|sendBeacon|analytics|telemetry/i);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
});
