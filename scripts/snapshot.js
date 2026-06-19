#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultFile = path.join(root, 'snapshots', 'latest-store.json');
const args = process.argv.slice(2);
const exportIndex = args.indexOf('--export');
const importIndex = args.indexOf('--import');

if (exportIndex >= 0) {
  const file = path.resolve(root, args[exportIndex + 1] || defaultFile);
  mkdirSync(path.dirname(file), { recursive: true });
  const payload = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    store: readJsonIfExists(defaultFile)?.store || {}
  };
  writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[OmniCore] snapshot exported: ${file}`);
  process.exit(0);
}

if (importIndex >= 0) {
  const file = path.resolve(root, args[importIndex + 1] || defaultFile);
  if (!existsSync(file)) {
    console.error(`[OmniCore] snapshot file not found: ${file}`);
    process.exit(1);
  }
  mkdirSync(path.dirname(defaultFile), { recursive: true });
  const payload = readJsonIfExists(file);
  writeFileSync(defaultFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[OmniCore] snapshot imported: ${file}`);
  process.exit(0);
}

console.log('Usage: npm run snapshot -- --export [file] | --import [file]');

function readJsonIfExists(file) {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}
