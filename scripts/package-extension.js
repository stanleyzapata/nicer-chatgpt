#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

const args = process.argv.slice(2);
const root = path.resolve(option(args, '--root') || path.resolve(__dirname, '..'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (manifest.version !== packageJson.version) fail(`package.json (${packageJson.version}) and manifest.json (${manifest.version}) must match.`);

const output = path.resolve(option(args, '--output') || path.join(root, 'dist', `nicer-chatgpt-${manifest.version}.zip`));
const contents = ['manifest.json', 'popup', 'src', 'styles', 'icons', 'README.md', 'PRIVACY.md', 'LICENSE'];
for (const item of contents) if (!fs.existsSync(path.join(root, item))) fail(`Missing package input: ${item}`);

fs.mkdirSync(path.dirname(output), { recursive: true });
if (fs.existsSync(output)) fs.unlinkSync(output);
execFileSync('zip', ['-r', '-X', output, ...contents], { cwd: root, stdio: 'inherit' });
process.stdout.write(`Created ${output}\n`);
