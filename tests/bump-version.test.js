const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.resolve(__dirname, '..', 'scripts', 'bump-version.js');

function fixture(packageVersion, manifestVersion) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nicer-chatgpt-version-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'nicer-chatgpt', version: packageVersion }, null, 2));
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Nicer ChatGPT', version: manifestVersion }, null, 2));
  return root;
}

function readVersion(root, file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')).version;
}

test('bumps package and manifest versions together', () => {
  const root = fixture('1.0.0', '1.0.0');
  try {
    const result = spawnSync(process.execPath, [script, 'minor', '--root', root], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readVersion(root, 'package.json'), '1.1.0');
    assert.equal(readVersion(root, 'manifest.json'), '1.1.0');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('refuses to bump mismatched source versions', () => {
  const root = fixture('1.0.0', '1.0.1');
  try {
    const result = spawnSync(process.execPath, [script, 'patch', '--root', root], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must match/);
    assert.equal(readVersion(root, 'package.json'), '1.0.0');
    assert.equal(readVersion(root, 'manifest.json'), '1.0.1');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
