#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { generateApiDocs } from '../src/docs/ApiDocGenerator.js';

const outIndex = process.argv.indexOf('--out');
const outDir = outIndex >= 0 && process.argv[outIndex + 1]
  ? path.resolve(process.argv[outIndex + 1])
  : path.resolve('docs/api-site');
const srcDir = path.resolve('src');
const scriptInputs = [
  path.resolve(process.argv[1] || 'scripts/generate-api-docs.js'),
  path.resolve('src/docs/ApiDocGenerator.js'),
  ...listJavaScriptFiles(srcDir)
];
const outputFiles = [
  path.join(outDir, 'manifest.json'),
  path.join(outDir, 'index.html')
];

if (reportsAreFresh(outputFiles, scriptInputs)) {
  console.log(`[OmniCore] API docs generated: cached -> ${outDir}`);
} else {
  const result = generateApiDocs({
    srcDir,
    outDir
  });

  console.log(`[OmniCore] API docs generated: ${result.modules.length} modules -> ${outDir}`);
}

function reportsAreFresh(outputs, inputs) {
  const outputTimes = outputs.map(mtimeMs);
  if (outputTimes.some((time) => time <= 0)) return false;
  const newestInput = Math.max(...inputs.map(mtimeMs));
  return Math.min(...outputTimes) >= newestInput;
}

function mtimeMs(file) {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function listJavaScriptFiles(root) {
  if (!existsSync(root)) return [];
  const entries = readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(fullPath);
    return /\.(js|mjs)$/u.test(entry.name) ? [fullPath] : [];
  });
}
