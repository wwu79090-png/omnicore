#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { existsSync, statSync } from 'node:fs';

runVite(['build', '--mode', 'production']);
runVite(['build', '--config', 'vite.lean.config.js', '--mode', 'production']);

const coreFile = path.resolve('dist/omnicore-core.js');
if (existsSync(coreFile)) {
  const { size } = statSync(coreFile);
  console.log(`[OmniCore] lean core ESM size: ${size} bytes`);
  if (size > 40 * 1024) {
    console.error('[OmniCore] lean core ESM exceeds 40KB budget.');
    process.exit(1);
  }
}

function runVite(args) {
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', ['npx', 'vite', ...args].join(' ')], { stdio: 'inherit' })
    : spawnSync('npx', ['vite', ...args], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
