#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function createReleaseChecklistReport({
  generatedAt = new Date().toISOString(),
  files = readWorkspaceFiles(),
  releaseWorkflow = readTextFile('.github/workflows/release.yml'),
  packageJson = readJsonFile('package.json'),
  publishDryRunOk = readPublishDryRunOk()
} = {}) {
  const checks = [
    fileCheck('security-policy', files, 'SECURITY.md'),
    fileCheck('support-policy', files, 'SUPPORT.md'),
    fileCheck('code-of-conduct', files, 'CODE_OF_CONDUCT.md'),
    fileCheck('compatibility-matrix', files, 'docs/platforms/compatibility-matrix.md'),
    fileCheck('real-device-guide', files, 'docs/performance/real-device-capture-guide.md'),
    fileCheck('dependency-inventory', files, 'docs/release-notes/dependency-inventory.json'),
    contentCheck('npm-provenance-workflow', releaseWorkflow, 'npm publish --provenance --access public'),
    contentCheck('release-deps-script', JSON.stringify(packageJson.scripts || {}), 'release:deps'),
    contentCheck('release-checklist-script', JSON.stringify(packageJson.scripts || {}), 'release:checklist'),
    valueCheck('publish-dry-run', publishDryRunOk, 'npm publish dry-run report is clean.')
  ];
  return {
    format: 'OmniCore.ReleaseChecklistReport',
    version: 1,
    generatedAt,
    ok: checks.every((check) => check.ok),
    checks,
    blockers: checks.filter((check) => !check.ok).map((check) => ({
      id: check.id,
      message: check.message
    }))
  };
}

export function writeReleaseChecklistReport(
  report,
  out = path.join('docs', 'release-notes', 'release-checklist-report.json')
) {
  const outFile = path.resolve(out);
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return outFile;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = createReleaseChecklistReport();
  const outFile = writeReleaseChecklistReport(report, options.out);
  console.log(`[OmniCore] release checklist ${report.ok ? 'passed' : 'blocked'}: ${outFile}`);
  if (options.strict && !report.ok) process.exitCode = 1;
  return report;
}

function fileCheck(id, files, file) {
  return valueCheck(id, files.has(file), `${file} exists.`);
}

function contentCheck(id, text, needle) {
  return valueCheck(id, String(text || '').includes(needle), `Expected content: ${needle}`);
}

function valueCheck(id, ok, message) {
  return {
    id,
    ok: Boolean(ok),
    message
  };
}

function readWorkspaceFiles() {
  const required = [
    'SECURITY.md',
    'SUPPORT.md',
    'CODE_OF_CONDUCT.md',
    'docs/platforms/compatibility-matrix.md',
    'docs/performance/real-device-capture-guide.md',
    'docs/release-notes/dependency-inventory.json',
    '.github/workflows/release.yml'
  ];
  return new Set(required.filter((file) => existsSync(path.resolve(file))));
}

function readTextFile(file) {
  const target = path.resolve(file);
  return existsSync(target) ? readFileSync(target, 'utf8') : '';
}

function readJsonFile(file) {
  return JSON.parse(readFileSync(path.resolve(file), 'utf8'));
}

function readPublishDryRunOk() {
  try {
    return JSON.parse(readTextFile(path.join('docs', 'release-notes', 'npm-publish-dry-run-report.json'))).ok === true;
  } catch {
    return false;
  }
}

function parseArgs(argv = []) {
  const options = {
    out: path.join('docs', 'release-notes', 'release-checklist-report.json'),
    strict: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out') {
      index += 1;
      options.out = argv[index];
    } else if (argv[index] === '--strict') {
      options.strict = true;
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
