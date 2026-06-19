#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildEngineImprovementPlan,
  formatEngineImprovementMarkdown
} from '../src/quality/ImprovementPlanner.js';

export function runEngineImprovementsCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const plan = buildEngineImprovementPlan({
    generatedAt: options.generatedAt || new Date().toISOString()
  });
  const json = `${JSON.stringify(plan, null, 2)}\n`;
  const markdown = formatEngineImprovementMarkdown(plan);

  if (options.out) writeText(path.resolve(options.out), json);
  if (options.markdown) writeText(path.resolve(options.markdown), markdown);
  if (!options.out && !options.markdown) process.stdout.write(markdown);
  return plan;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    } else if (arg === '--markdown') {
      index += 1;
      options.markdown = argv[index];
    } else if (arg === '--generated-at') {
      index += 1;
      options.generatedAt = argv[index];
    }
  }
  return options;
}

function writeText(file, content) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) runEngineImprovementsCli();

export default runEngineImprovementsCli;
