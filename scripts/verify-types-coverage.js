#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createTypeDeclarationSource } from './build.js';

export const DEFAULT_REQUIRED_TYPE_SYMBOLS = [
  'optimizeRenderQueueForBatching',
  'createRuntimeObjectPools',
  'DirtyFlagTracker',
  'createAsyncAssetPipeline',
  'createIncrementalSpatialIndexReport',
  'WorkerTaskScheduler',
  'createTextureBudgetPlan',
  'createTilemapChunkStreamPlan',
  'createAnimationLODPlan',
  'createWebGPUInstancingDescriptor',
  'createWebGPUTextureArrayBatch',
  'createWebGPUComputeDispatchPlan'
];

export function createTypeCoverageReport({
  declarationSource = null,
  declarationFile = path.join('dist', 'omnicore.d.ts'),
  requiredSymbols = DEFAULT_REQUIRED_TYPE_SYMBOLS,
  generatedAt = new Date().toISOString()
} = {}) {
  const source = declarationSource ?? readDeclarationSource(declarationFile);
  const coveredSymbols = requiredSymbols.filter((symbol) => declarationContainsSymbol(source, symbol));
  const missingSymbols = requiredSymbols.filter((symbol) => !coveredSymbols.includes(symbol));
  return {
    format: 'OmniCore.TypeCoverageReport',
    version: 1,
    generatedAt,
    ok: missingSymbols.length === 0,
    declarationFile,
    requiredSymbols: [...requiredSymbols],
    coveredSymbols,
    missingSymbols
  };
}

export function writeTypeCoverageReport(report, out = path.join('docs', 'release-notes', 'types-coverage-report.json')) {
  const outFile = path.resolve(out);
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return outFile;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = createTypeCoverageReport({
    declarationFile: options.declarationFile || path.join('dist', 'omnicore.d.ts'),
    declarationSource: options.useBuildSource ? createTypeDeclarationSource() : null,
    generatedAt: options.generatedAt
  });
  const outFile = writeTypeCoverageReport(report, options.out);
  console.log(`[OmniCore] Type coverage ${report.ok ? 'passed' : 'failed'}: ${outFile}`);
  if (!report.ok) {
    for (const symbol of report.missingSymbols) console.error(`[types:coverage] missing ${symbol}`);
    process.exitCode = 1;
  }
  return report;
}

function readDeclarationSource(declarationFile) {
  const absolute = path.resolve(declarationFile);
  if (existsSync(absolute)) return readFileSync(absolute, 'utf8');
  return createTypeDeclarationSource();
}

function declarationContainsSymbol(source, symbol) {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'u').test(source);
}

function parseArgs(argv = []) {
  const options = {
    out: path.join('docs', 'release-notes', 'types-coverage-report.json'),
    declarationFile: path.join('dist', 'omnicore.d.ts'),
    useBuildSource: true,
    generatedAt: undefined
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    } else if (arg === '--declaration') {
      index += 1;
      options.declarationFile = argv[index];
    } else if (arg === '--use-build-source') {
      options.useBuildSource = true;
    } else if (arg === '--check-dist') {
      options.useBuildSource = false;
    } else if (arg === '--generated-at') {
      index += 1;
      options.generatedAt = argv[index];
    }
  }
  return options;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  main();
}

export default main;
