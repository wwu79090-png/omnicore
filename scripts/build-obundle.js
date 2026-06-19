#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import OBundle from '../src/assets/OBundle.js';

const input = path.resolve(readArg('--assets') || 'assets');
const output = path.resolve(readArg('--out') || 'dist/assets.omnicore.obundle');

if (!existsSync(input)) {
  console.error(`[OmniCore] assets directory not found: ${input}`);
  process.exit(1);
}

const assets = collect(input).map((filePath) => {
  const key = path.relative(input, filePath).replace(/\\/g, '/');
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') return { key, type: 'json', data: JSON.parse(readFileSync(filePath, 'utf8')) };
  if (['.txt', '.csv', '.md', '.svg'].includes(ext)) return { key, type: 'text', data: readFileSync(filePath, 'utf8') };
  return { key, type: 'binary', data: readFileSync(filePath).toString('base64') };
});

const bundle = OBundle.build({ assets });
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, Buffer.from(bundle));
console.log(`[OmniCore] wrote ${assets.length} assets to ${output}`);

function collect(dir) {
  return readdirSync(dir)
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry);
      return statSync(fullPath).isDirectory() ? collect(fullPath) : fullPath;
    });
}

function readArg(key) {
  const index = process.argv.indexOf(key);
  return index >= 0 ? process.argv[index + 1] : null;
}
