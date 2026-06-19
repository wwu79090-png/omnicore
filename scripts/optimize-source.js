#!/usr/bin/env node
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const LOOP_PATTERN = /\b(for|while)\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/gu;
const ALLOC_PATTERN = /new\s+(Entity|Sprite)\s*\([^)]*\)/gu;

export function optimizeSource(source) {
  const rewrites = [];
  const output = source.replace(LOOP_PATTERN, (block) => block.replace(ALLOC_PATTERN, (match, type) => {
    rewrites.push({ type, from: match, to: `OmniCore.Pool.allocate('${type}')` });
    return `OmniCore.Pool.allocate('${type}')`;
  }));
  return {
    changed: output !== source,
    output,
    rewrites
  };
}

export function optimizeGameSources({ root = process.cwd(), logger = console.log } = {}) {
  const targets = collectJsFiles(path.join(root, 'src', 'game'));
  let filesChanged = 0;
  const files = [];

  for (const file of targets) {
    const source = readFileSync(file, 'utf8');
    const result = optimizeSource(source);
    if (!result.changed) continue;
    writeFileSync(file, result.output);
    filesChanged += 1;
    files.push({ file, rewrites: result.rewrites.length });
    logger(`[OmniCore] optimized ${path.relative(root, file)} (${result.rewrites.length} rewrites)`);
  }

  return { root, filesChanged, files };
}

function collectJsFiles(dir) {
  try {
    const info = statSync(dir);
    if (!info.isDirectory()) return [];
  } catch {
    return [];
  }

  const files = [];
  for (const entry of readdirSync(dir)) {
    const filePath = path.join(dir, entry);
    const info = statSync(filePath);
    if (info.isDirectory()) files.push(...collectJsFiles(filePath));
    else if (filePath.endsWith('.js')) files.push(filePath);
  }
  return files;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const report = optimizeGameSources();
  mkdirSync(path.join(process.cwd(), 'docs', 'release-notes'), { recursive: true });
  writeFileSync(
    path.join(process.cwd(), 'docs', 'release-notes', 'optimize-source-report.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  console.log(JSON.stringify(report, null, 2));
}
