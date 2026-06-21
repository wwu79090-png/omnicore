#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_BUDGETS = {
  runtime: 3 * 1024 * 1024,
  editor: 512 * 1024,
  examples: 2 * 1024 * 1024,
  docs: 16 * 1024 * 1024,
  assets: 9 * 1024 * 1024,
  npmTarball: 20 * 1024 * 1024
};

const BUCKETS = [
  { name: 'runtime', roots: ['dist/omnicore.esm.js', 'dist/omnicore-core.js', 'src'] },
  { name: 'editor', roots: ['packages/omnicore-editor'] },
  { name: 'examples', roots: ['examples'] },
  { name: 'docs', roots: ['docs', 'README.md'] },
  { name: 'assets', roots: ['assets'] },
  { name: 'npmTarball', roots: ['package.json', 'dist', 'scripts', 'docs', 'examples'] }
];

export function createSizeAuditReport({
  root = process.cwd(),
  budgets = DEFAULT_BUDGETS,
  generatedAt = new Date().toISOString()
} = {}) {
  const normalizedRoot = path.resolve(root);
  const buckets = BUCKETS.map((bucket) => createBucketReport(normalizedRoot, bucket, budgets[bucket.name]));
  const failures = buckets.filter((bucket) => !bucket.ok).map((bucket) => ({
    bucket: bucket.name,
    bytes: bucket.bytes,
    budgetBytes: bucket.budgetBytes,
    overBy: bucket.overBy,
    largest: bucket.largestFiles[0] || null
  }));
  return {
    format: 'OmniCore.SizeAudit',
    version: 1,
    generatedAt,
    root: normalizedRoot,
    ok: failures.length === 0,
    buckets,
    failures
  };
}

function createBucketReport(root, bucket, budgetBytes = Number.POSITIVE_INFINITY) {
  const files = bucket.roots.flatMap((entry) => collectEntry(path.join(root, entry), root));
  const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const overBy = Math.max(0, bytes - budgetBytes);
  return {
    name: bucket.name,
    roots: bucket.roots,
    bytes,
    budgetBytes,
    overBy,
    ok: overBy === 0,
    fileCount: files.length,
    largestFiles: files
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 8)
  };
}

function collectEntry(entry, root) {
  if (!existsSync(entry)) return [];
  const name = path.basename(entry);
  if (name === 'node_modules' || name === '.git') return [];
  const stat = statSync(entry);
  if (stat.isFile()) {
    return [{ path: slash(path.relative(root, entry)), bytes: stat.size }];
  }
  const output = [];
  for (const child of readdirSync(entry)) {
    output.push(...collectEntry(path.join(entry, child), root));
  }
  return output;
}

function slash(value) {
  return String(value).replace(/\\/gu, '/');
}

function parseArgs(argv = []) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      index += 1;
      options.root = argv[index];
    } else if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    }
  }
  return options;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const options = parseArgs(process.argv.slice(2));
  const report = createSizeAuditReport(options);
  if (options.out) {
    const target = path.resolve(options.out);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

export default createSizeAuditReport;
