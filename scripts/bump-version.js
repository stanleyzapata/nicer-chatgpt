#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseArgs(args) {
  const kind = args[0];
  const rootIndex = args.indexOf('--root');
  const root = rootIndex >= 0 ? args[rootIndex + 1] : path.resolve(__dirname, '..');
  if (!['major', 'minor', 'patch'].includes(kind)) fail('Use: npm run bump -- <major|minor|patch>');
  if (!root) fail('--root requires a directory');
  return { kind, root: path.resolve(root) };
}

function parseVersion(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) fail(`Unsupported version: ${value}. Use major.minor.patch.`);
  return match.slice(1).map(Number);
}

function nextVersion(value, kind) {
  const [major, minor, patch] = parseVersion(value);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const { kind, root } = parseArgs(process.argv.slice(2));
const packageFile = path.join(root, 'package.json');
const manifestFile = path.join(root, 'manifest.json');
const packageJson = readJson(packageFile);
const manifest = readJson(manifestFile);

if (packageJson.version !== manifest.version) fail(`package.json (${packageJson.version}) and manifest.json (${manifest.version}) must match.`);

const version = nextVersion(packageJson.version, kind);
packageJson.version = version;
manifest.version = version;
writeJson(packageFile, packageJson);
writeJson(manifestFile, manifest);
process.stdout.write(`Bumped version to ${version}\n`);
