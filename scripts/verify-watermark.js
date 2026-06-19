#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { verifyWatermark } from './watermark-build.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/verify-watermark.js dist/omnicore.esm.js');
  process.exit(1);
}

const source = await readFile(file, 'utf8');
console.log(JSON.stringify(verifyWatermark(source), null, 2));
