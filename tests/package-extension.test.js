const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const script = path.resolve(__dirname, '..', 'scripts', 'package-extension.js');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nicer-chatgpt-package-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'nicer-chatgpt', version: '1.2.3' }));
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Nicer ChatGPT', version: '1.2.3' }));
  for (const directory of ['popup', 'src', 'styles', 'icons']) {
    fs.mkdirSync(path.join(root, directory));
    fs.writeFileSync(path.join(root, directory, 'fixture.txt'), directory);
  }
  for (const file of ['README.md', 'PRIVACY.md', 'LICENSE']) fs.writeFileSync(path.join(root, file), file);
  return root;
}

test('packages an installable ZIP with the manifest at its root', () => {
  const root = fixture();
  const output = path.join(root, 'release.zip');
  try {
    const result = spawnSync(process.execPath, [script, '--root', root, '--output', output], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const entries = execFileSync('unzip', ['-Z1', output], { encoding: 'utf8' }).trim().split('\n');
    assert.ok(entries.includes('manifest.json'));
    assert.ok(entries.includes('popup/fixture.txt'));
    assert.ok(!entries.some((entry) => entry.startsWith('tests/')));
    assert.equal(JSON.parse(execFileSync('unzip', ['-p', output, 'manifest.json'], { encoding: 'utf8' })).version, '1.2.3');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
