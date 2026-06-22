#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildEngineCapabilityAtlas,
  renderEngineCapabilityMarkdown
} from '../src/quality/EngineCapabilityAtlas.js';

const root = process.cwd();

function parseArgs(argv) {
  const options = {
    generatedAt: '1970-01-01T00:00:00.000Z',
    out: path.join(root, 'docs', 'release-notes', 'engine-capability-atlas.json'),
    markdown: path.join(root, 'docs', 'release-notes', 'engine-capability-atlas.md')
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--generated-at') {
      index += 1;
      options.generatedAt = argv[index];
    } else if (arg === '--out') {
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

export function runEngineCapabilityAtlasCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = buildEngineCapabilityAtlas({
    projectRoot: root,
    generatedAt: options.generatedAt
  });
  writeText(options.out, `${JSON.stringify(report, null, 2)}\n`);
  writeText(options.markdown, renderEngineCapabilityMarkdown(report));
  process.stdout.write(`engine capability atlas written: ${options.out}\n`);
  process.stdout.write(`engine capability atlas markdown written: ${options.markdown}\n`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runEngineCapabilityAtlasCli();
}

export default runEngineCapabilityAtlasCli;
