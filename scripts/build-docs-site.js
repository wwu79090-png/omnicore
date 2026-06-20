#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateApiDocs } from '../src/docs/ApiDocGenerator.js';

export default function buildDocsSite({
  srcDir = path.resolve('src'),
  outDir = path.resolve('docs/api'),
  siteDomain = 'docs.omnicore.dev'
} = {}) {
  return generateApiDocs({
    srcDir,
    outDir,
    siteDomain
  });
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--src') {
      index += 1;
      options.srcDir = path.resolve(argv[index]);
    } else if (arg === '--out') {
      index += 1;
      options.outDir = path.resolve(argv[index]);
    } else if (arg === '--site-domain') {
      index += 1;
      options.siteDomain = argv[index];
    } else if (arg === '--no-cname') {
      options.siteDomain = null;
    }
  }
  return options;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const options = parseArgs(process.argv.slice(2));
  const manifest = buildDocsSite(options);
  process.stdout.write(`[OmniCore] JSDoc HTML docs generated: ${manifest.modules.length} modules -> ${path.resolve(options.outDir || 'docs/api')}\n`);
}
