#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (args.includes('--dry-run')) {
  console.log('[OmniCore] contract test command: vitest run tests/contract');
  process.exit(0);
}

const vitestBin = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(process.execPath, [
  vitestBin,
  'run',
  'tests/contract'
], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true
});

process.exit(result.status ?? 1);
