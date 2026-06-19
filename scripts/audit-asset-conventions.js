#!/usr/bin/env node
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_ASSET_DIRECTORIES } from '../src/config/defaults.js';

const ROOT = process.cwd();
const ASSETS_ROOT = path.join(ROOT, 'assets');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const output = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    output.push({ entry, full });
    if (entry.isDirectory()) output.push(...await walk(full));
  }
  return output;
}

async function main() {
  const entries = await walk(ASSETS_ROOT);
  const allowed = new Set(DEFAULT_ASSET_DIRECTORIES);
  const findings = [];

  for (const { entry, full } of entries) {
    const relative = path.relative(ASSETS_ROOT, full).replaceAll(path.sep, '/');
    if (!relative) continue;
    const [top] = relative.split('/');
    if (!allowed.has(top)) findings.push(`assets/${relative}: top-level asset folder must be one of ${DEFAULT_ASSET_DIRECTORIES.join(', ')}`);
    if (entry.isFile() && /[A-Z\s]/u.test(entry.name)) findings.push(`assets/${relative}: filenames must be lowercase kebab-case or numeric variants`);
    if (entry.isFile() && entry.name === '.gitkeep') findings.push(`assets/${relative}: empty placeholder files are not allowed in release assets`);
  }

  if (findings.length) {
    console.error(findings.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('Asset convention audit passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
