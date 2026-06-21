#!/usr/bin/env node
import {
  mkdirSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRuntimeSoakReport } from '../src/quality/RuntimeSoakHarness.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const options = {
    out: path.join('docs', 'release-notes', 'runtime-soak-report.json')
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    } else if (arg === '--iterations') {
      index += 1;
      options.iterations = Number(argv[index]);
    } else if (arg === '--sprites') {
      index += 1;
      options.spritesPerScene = Number(argv[index]);
    } else if (arg === '--resources') {
      index += 1;
      options.resourcesPerScene = Number(argv[index]);
    } else if (arg === '--tweens') {
      index += 1;
      options.tweensPerScene = Number(argv[index]);
    } else if (arg === '--hot-paths') {
      options.includeHotPathMetrics = true;
    }
  }
  return options;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = createRuntimeSoakReport(options);
  const outFile = path.resolve(root, options.out);
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[OmniCore] runtime soak report written: ${outFile}`);
  if (!report.ok) {
    for (const leak of report.leaks) console.error(`[soak] ${leak.code}: ${JSON.stringify(leak)}`);
    process.exitCode = 1;
  }
  return report;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  main();
}

export default main;
