#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import StaticBatchCompiler from '../src/renderer/StaticBatchCompiler.js';

export function buildStaticBatches({
  scenesDir = 'examples',
  out = 'dist/static-batches.json',
  optional = false,
  logger = console.log
} = {}) {
  const root = process.cwd();
  const scenesRoot = path.resolve(root, scenesDir);
  const outPath = path.resolve(root, out);
  const report = {
    scenesDir: slash(path.relative(root, scenesRoot)) || '.',
    out: slash(path.relative(root, outPath)),
    scanned: 0,
    compiled: 0,
    drawCallsBefore: 0,
    drawCallsAfter: 0,
    savedDrawCalls: 0,
    manifests: []
  };

  if (!existsSync(scenesRoot)) {
    if (!optional) throw new Error(`Static batch scene directory not found: ${scenesRoot}`);
    writeReport(outPath, report);
    logger(`[OmniCore] static batching skipped; ${scenesDir} not found`);
    return report;
  }

  for (const file of listJsonFiles(scenesRoot)) {
    report.scanned += 1;
    let scene = null;
    try {
      scene = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    const manifest = StaticBatchCompiler.compileScene(scene, {
      scenePath: slash(path.relative(root, file))
    });
    if (!manifest.batches.length) continue;
    report.compiled += 1;
    report.drawCallsBefore += manifest.drawCallsBefore;
    report.drawCallsAfter += manifest.drawCallsAfter;
    report.savedDrawCalls += manifest.savedDrawCalls;
    report.manifests.push(manifest);
  }

  writeReport(outPath, report);
  logger(`[OmniCore] static batching compiled ${report.compiled}/${report.scanned} scene files`);
  return report;
}

export default buildStaticBatches;

function writeReport(outPath, report) {
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function listJsonFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const filePath = path.join(dir, entry);
    const info = statSync(filePath);
    if (info.isDirectory()) files.push(...listJsonFiles(filePath));
    else if (filePath.endsWith('.json')) files.push(filePath);
  }
  return files;
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--scenes') {
      index += 1;
      options.scenesDir = argv[index];
    } else if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    } else if (arg === '--optional') {
      options.optional = true;
    }
  }
  return options;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  buildStaticBatches(parseArgs());
}
