#!/usr/bin/env node
import path from 'node:path';
import { generateApiDocs } from '../src/docs/ApiDocGenerator.js';

const outIndex = process.argv.indexOf('--out');
const outDir = outIndex >= 0 && process.argv[outIndex + 1]
  ? path.resolve(process.argv[outIndex + 1])
  : path.resolve('docs/api-site');

const result = generateApiDocs({
  srcDir: path.resolve('src'),
  outDir
});

console.log(`[OmniCore] API docs generated: ${result.modules.length} modules -> ${outDir}`);
