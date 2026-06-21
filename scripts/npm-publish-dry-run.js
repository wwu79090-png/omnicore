#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_REQUIRED_FILES = [
  'package.json',
  'README.md',
  'LICENSE',
  'src/index.js',
  'dist/omnicore.esm.js',
  'dist/omnicore.d.ts'
];

const DEFAULT_LIMITS = {
  maxPackageBytes: 5 * 1024 * 1024,
  maxUnpackedBytes: 25 * 1024 * 1024,
  maxEntryCount: 1200
};

export function parsePublishDryRunArgs(argv = []) {
  const options = {
    root: process.cwd(),
    out: path.join('docs', 'release-notes', 'npm-publish-dry-run-report.json'),
    jsonFile: null,
    ...DEFAULT_LIMITS
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      index += 1;
      options.root = path.resolve(argv[index]);
    } else if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    } else if (arg === '--json-file') {
      index += 1;
      options.jsonFile = argv[index];
    } else if (arg === '--max-package-mb') {
      index += 1;
      options.maxPackageBytes = Math.floor(Number(argv[index]) * 1024 * 1024);
    } else if (arg === '--max-unpacked-mb') {
      index += 1;
      options.maxUnpackedBytes = Math.floor(Number(argv[index]) * 1024 * 1024);
    } else if (arg === '--max-files') {
      index += 1;
      options.maxEntryCount = Number(argv[index]);
    }
  }
  return options;
}

export function parseNpmPackJsonOutput(output = '') {
  const text = String(output);
  const start = text.search(/\[\s*\{\s*"id"\s*:/u);
  if (start < 0) throw new Error('npm pack --json output did not include a package JSON array.');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) return JSON.parse(text.slice(start, index + 1));
    }
  }
  throw new Error('npm pack --json output ended before the package JSON array closed.');
}

export function createPublishDryRunReport(packages = [], input = {}) {
  const options = {
    requiredFiles: DEFAULT_REQUIRED_FILES,
    ...DEFAULT_LIMITS,
    ...input
  };
  const packageEntry = packages[0] || null;
  if (!packageEntry) {
    return {
      ok: false,
      package: null,
      limits: extractLimits(options),
      requiredFiles: options.requiredFiles.map((filePath) => ({ path: normalizePath(filePath), present: false })),
      largestFiles: [],
      violations: [{ code: 'missing-package-entry', message: 'npm pack returned no package entries.' }]
    };
  }

  const files = (packageEntry.files || []).map((file) => ({
    path: normalizePath(file.path),
    size: Number(file.size || 0)
  }));
  const fileSet = new Set(files.map((file) => file.path));
  const entryCount = Number(packageEntry.entryCount || files.length);
  const requiredFiles = options.requiredFiles.map((filePath) => {
    const normalized = normalizePath(filePath);
    return {
      path: normalized,
      present: fileSet.has(normalized)
    };
  });
  const largestFiles = [...files]
    .sort((left, right) => right.size - left.size || left.path.localeCompare(right.path))
    .slice(0, 10);
  const packageQuality = createPackageQualityReport({ files, fileSet });
  const limits = extractLimits(options);
  const violations = [];

  for (const file of requiredFiles) {
    if (!file.present) {
      violations.push({
        code: 'missing-required-file',
        path: file.path,
        message: `Required npm package file is missing: ${file.path}`
      });
    }
  }
  if (Number(packageEntry.size || 0) > limits.maxPackageBytes) {
    violations.push({
      code: 'package-size-over-budget',
      actual: Number(packageEntry.size || 0),
      limit: limits.maxPackageBytes,
      message: 'Packed npm tarball exceeds the configured package size budget.'
    });
  }
  if (Number(packageEntry.unpackedSize || 0) > limits.maxUnpackedBytes) {
    violations.push({
      code: 'unpacked-size-over-budget',
      actual: Number(packageEntry.unpackedSize || 0),
      limit: limits.maxUnpackedBytes,
      message: 'Unpacked npm package exceeds the configured size budget.'
    });
  }
  if (entryCount > limits.maxEntryCount) {
    violations.push({
      code: 'entry-count-over-budget',
      actual: entryCount,
      limit: limits.maxEntryCount,
      message: 'npm package contains more files than the configured entry count budget.'
    });
  }
  for (const file of packageQuality.suspiciousFiles) {
    violations.push({
      code: 'suspicious-package-file',
      path: file,
      message: `npm package contains a suspicious file: ${file}`
    });
  }

  return {
    ok: violations.length === 0,
    package: {
      id: packageEntry.id || `${packageEntry.name}@${packageEntry.version}`,
      name: packageEntry.name,
      version: packageEntry.version,
      filename: packageEntry.filename || null,
      size: Number(packageEntry.size || 0),
      unpackedSize: Number(packageEntry.unpackedSize || 0),
      entryCount
    },
    limits,
    requiredFiles,
    largestFiles,
    packageQuality,
    violations
  };
}

export function runNpmPackDryRun(root = process.cwd()) {
  const npm = resolveNpmPackCommand(['pack', '--dry-run', '--json']);
  const result = spawnSync(npm.command, npm.args, {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_loglevel: 'notice'
    },
    windowsHide: true
  });
  if (result.error) throw result.error;
  const combinedOutput = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status !== 0) {
    throw new Error(`npm pack --dry-run failed with exit code ${result.status}\n${combinedOutput.trim()}`);
  }
  return parseNpmPackJsonOutput(combinedOutput);
}

export function resolveNpmPackCommand(args = [], platform = process.platform) {
  if (platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', ['npm.cmd', ...args.map(quoteCmdArg)].join(' ')]
    };
  }
  return {
    command: 'npm',
    args
  };
}

export function writePublishDryRunReport(report, root = process.cwd(), out = path.join('docs', 'release-notes', 'npm-publish-dry-run-report.json')) {
  const outFile = path.resolve(root, out);
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return outFile;
}

export function main(argv = process.argv.slice(2)) {
  const options = parsePublishDryRunArgs(argv);
  const root = path.resolve(options.root);
  const packages = options.jsonFile
    ? JSON.parse(readFileSync(path.resolve(root, options.jsonFile), 'utf8'))
    : runNpmPackDryRun(root);
  const report = createPublishDryRunReport(packages, options);
  const outFile = writePublishDryRunReport(report, root, options.out);
  const status = report.ok ? 'passed' : 'failed';
  console.log(`[OmniCore] npm publish dry-run ${status}: ${outFile}`);
  if (!report.ok) {
    for (const violation of report.violations) console.error(`[publish:dry-run] ${violation.code}: ${violation.message}`);
    process.exitCode = 1;
  }
  return report;
}

function extractLimits(options) {
  return {
    maxPackageBytes: Number(options.maxPackageBytes),
    maxUnpackedBytes: Number(options.maxUnpackedBytes),
    maxEntryCount: Number(options.maxEntryCount)
  };
}

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/gu, '/');
}

function createPackageQualityReport({ files = [], fileSet = new Set() } = {}) {
  const paths = files.map((file) => normalizePath(file.path));
  const includedExamples = paths.filter((filePath) => filePath.startsWith('examples/')).sort();
  const includedDocs = paths.filter((filePath) => filePath.startsWith('docs/')).sort();
  const suspiciousFiles = paths.filter(isSuspiciousPackagePath).sort();
  return {
    provenanceReady: fileSet.has('package.json') && fileSet.has('README.md') && fileSet.has('LICENSE'),
    sbomReady: fileSet.has('package.json') && fileSet.has('LICENSE'),
    treeShakingReady: fileSet.has('dist/omnicore.esm.js'),
    typeDeclarationsReady: fileSet.has('dist/omnicore.d.ts'),
    includedExamples,
    includedDocs,
    suspiciousFiles
  };
}

function isSuspiciousPackagePath(filePath) {
  return /(^|\/)(\.env|id_rsa|npmrc|\.npmrc)(\.|$)/u.test(filePath)
    || /\.(pem|key|p12|pfx|crt)$/iu.test(filePath);
}

function quoteCmdArg(value) {
  return /[\s"]/u.test(value) ? `"${String(value).replace(/"/gu, '\\"')}"` : value;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  main();
}

export default main;
