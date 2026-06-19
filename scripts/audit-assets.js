#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const options = {
    assets: 'assets',
    scan: ['src', 'examples', 'README.md'],
    out: 'docs/release-notes/assets-audit-report.json'
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--assets') {
      options.assets = argv[index + 1];
      index += 1;
    } else if (arg === '--scan') {
      options.scan = [argv[index + 1]];
      index += 1;
    } else if (arg === '--out') {
      options.out = argv[index + 1];
      index += 1;
    }
  }
  return options;
}

async function walk(target) {
  const entries = await readdir(target, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const file = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else files.push(file);
  }
  return files;
}

async function readTextFiles(targets) {
  const files = [];
  for (const target of targets) {
    const statFiles = (await walk(target)).filter((file) => /\.(js|mjs|html|json|md|css)$/i.test(file));
    if (!statFiles.length && /\.(js|mjs|html|json|md|css)$/i.test(target)) files.push(target);
    files.push(...statFiles);
  }
  const content = [];
  for (const file of files) {
    try {
      content.push({ file, text: await readFile(file, 'utf8') });
    } catch {
      // Ignore unreadable generated files.
    }
  }
  return content;
}

function findReferences(content) {
  const refs = new Set();
  const pattern = /(?:['"`(=:\s])((?:\.\/|\.\.\/|\/)?assets\/[^'"`()\s,;]+)/g;
  for (const { text } of content) {
    for (const match of text.matchAll(pattern)) {
      const ref = match[1].replace(/^\.\//, '').replace(/^\//, '');
      if (!ref.endsWith('/')) refs.add(ref);
    }
  }
  return refs;
}

function normalizeAssetPath(root, file) {
  return path.relative(path.dirname(root), file).replaceAll(path.sep, '/');
}

async function auditAssets(options) {
  const assetsRoot = path.resolve(options.assets);
  const assetFiles = await walk(assetsRoot);
  const content = await readTextFiles(options.scan.map((item) => path.resolve(item)));
  const references = findReferences(content);
  const assetSet = new Set(assetFiles.map((file) => normalizeAssetPath(assetsRoot, file)));

  const missing = [...references]
    .filter((ref) => !assetSet.has(ref))
    .map((ref) => ({ path: ref }));
  const unused = [...assetSet]
    .filter((asset) => !references.has(asset))
    .map((asset) => ({ path: asset }));

  return {
    generatedAt: new Date().toISOString(),
    assetsRoot,
    scanned: options.scan,
    totalAssets: assetFiles.length,
    totalReferences: references.size,
    missing,
    unused
  };
}

const options = parseArgs(process.argv.slice(2));
const report = await auditAssets(options);
await mkdir(path.dirname(path.resolve(options.out)), { recursive: true });
await writeFile(path.resolve(options.out), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
