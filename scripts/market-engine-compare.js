#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildMarketEngineComparison, renderMarketEngineComparisonMarkdown } from '../src/quality/MarketEngineComparison.js';

const root = process.cwd();

function parseArgs(argv) {
  const options = {
    out: path.join(root, 'docs', 'release-notes', 'market-engine-comparison.json'),
    markdown: path.join(root, 'docs', 'release-notes', 'market-engine-comparison.md')
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') {
      index += 1;
      options.out = path.resolve(argv[index]);
    } else if (arg === '--markdown') {
      index += 1;
      options.markdown = path.resolve(argv[index]);
    }
  }
  return options;
}

function writeText(file, content) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

function runMarketEngineCompareCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = buildMarketEngineComparison();
  writeText(options.out, `${JSON.stringify(report, null, 2)}\n`);
  writeText(options.markdown, renderMarketEngineComparisonMarkdown(report));
  process.stdout.write(`market engine comparison written: ${options.out}\n`);
  process.stdout.write(`market engine comparison markdown written: ${options.markdown}\n`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runMarketEngineCompareCli();
}

export default runMarketEngineCompareCli;
