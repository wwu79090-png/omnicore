#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const addonDir = path.resolve(args.dir || process.cwd());
const outDir = path.resolve(args.out || 'dist/addons');
const manifestPath = path.join(addonDir, 'manifest.json');

if (!existsSync(manifestPath)) {
  console.error('[OmniCore] build:addon requires manifest.json in addon directory.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const name = manifest.name || path.basename(addonDir);
const version = manifest.version || '0.0.0';
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ ...manifest, builtAt: new Date().toISOString() }, null, 2));

const files = collectFiles(addonDir).map((file) => ({
  name: path.relative(addonDir, file).replaceAll('\\', '/'),
  content: readFileSync(file, 'utf8')
}));
const archive = {
  format: 'omnicore-addon-zip-compatible-manifest',
  name,
  version,
  files
};
const zipPath = path.join(outDir, `${name}-${version}.zip`);
writeFileSync(zipPath, JSON.stringify(archive, null, 2));
console.log(`[OmniCore] addon package created: ${zipPath}`);

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    result[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  return result;
}

function collectFiles(root) {
  const collected = [];
  for (const entryName of readdirSync(root)) {
    const target = path.join(root, entryName);
    const stats = statSync(target);
    if (stats.isDirectory()) collected.push(...collectFiles(target));
    else collected.push(target);
  }
  return collected;
}
