#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_OUT = path.join('docs', 'release-notes', 'publish-security-audit-report.json');
const TEXT_EXTENSIONS = new Set(['.cjs', '.css', '.html', '.js', '.json', '.md', '.mjs', '.ts', '.yml', '.yaml']);
const SCAN_TARGETS = ['src', 'scripts', 'api', 'website', '.github', 'docs', 'README.md', 'PRIVACY.md', 'package.json'];
const SKIPPED_PREFIXES = [
  'docs/api/',
  'docs/api-site/',
  'docs/api-typedoc/',
  'docs/release-notes/'
];

const SECRET_PATTERNS = [
  { id: 'github-token', regex: /gh[pousr]_[A-Za-z0-9_]{30,}/gu },
  { id: 'npm-token', regex: /npm_[A-Za-z0-9]{30,}/gu },
  { id: 'openai-token', regex: /sk-[A-Za-z0-9]{32,}/gu },
  { id: 'private-key', regex: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/gu }
];

export function createPublishSecurityAuditReport(input = {}) {
  const packageJson = input.packageJson || {};
  const scripts = packageJson.scripts || {};
  const readme = String(input.readme || '');
  const privacy = String(input.privacy || '');
  const releaseWorkflow = String(input.releaseWorkflow || '');
  const scannedFiles = Array.isArray(input.scannedFiles) ? input.scannedFiles : [];
  const secretFindings = scanHardcodedSecrets(scannedFiles);
  const gates = [
    createGate('publish-script', scripts['publish:audit'] === 'node scripts/publish-security-audit.js'),
    createGate('dry-run-script', scripts['publish:dry-run'] === 'node scripts/npm-publish-dry-run.js'),
    createGate('security-script', scripts['security-check'] === 'node scripts/security-check.js'),
    createGate('privacy-default-off', privacy.includes('默认不收集任何数据') && privacy.includes('telemetry: false') && privacy.includes('开发者自己决定')),
    createGate('readme-telemetry-notice', readme.includes('匿名遥测默认关闭') || readme.includes('telemetry: false')),
    createGate('release-workflow-order', workflowRunsBeforePublish(releaseWorkflow, 'npm run publish:audit')),
    createGate('secret-scan', secretFindings.length === 0, { scannedFiles: scannedFiles.length })
  ];
  const violations = [
    ...gates
      .filter((gate) => !gate.pass)
      .map((gate) => ({
        code: 'publish-audit-gate-failed',
        gate: gate.id,
        message: `Publish security audit gate failed: ${gate.id}`
      })),
    ...secretFindings
  ];
  return {
    ok: violations.length === 0,
    schema: 'omnicore.publish-security-audit.v1',
    gates,
    scannedFiles: scannedFiles.length,
    violations
  };
}

export function scanHardcodedSecrets(files = []) {
  const findings = [];
  for (const file of files) {
    const content = String(file.content || '');
    for (const pattern of SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;
      for (const match of content.matchAll(pattern.regex)) {
        findings.push({
          code: 'hardcoded-secret',
          type: pattern.id,
          path: file.path,
          line: lineNumberAt(content, match.index || 0),
          preview: maskSecret(match[0]),
          message: `Potential hardcoded ${pattern.id} found in publish package input.`
        });
      }
    }
  }
  return findings;
}

export function loadPublishSecurityAuditInput(root = process.cwd()) {
  return {
    packageJson: readJson(path.join(root, 'package.json')),
    readme: readIfExists(path.join(root, 'README.md')),
    privacy: readIfExists(path.join(root, 'PRIVACY.md')),
    releaseWorkflow: readIfExists(path.join(root, '.github', 'workflows', 'release.yml')),
    scannedFiles: collectScannedFiles(root)
  };
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const root = path.resolve(options.root);
  const input = loadPublishSecurityAuditInput(root);
  const report = createPublishSecurityAuditReport(input);
  const outFile = path.resolve(root, options.out);
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[OmniCore] publish security audit ${report.ok ? 'passed' : 'failed'}: ${outFile}`);
  if (!report.ok) {
    for (const violation of report.violations) console.error(`[publish:audit] ${violation.code}: ${violation.message}`);
    process.exitCode = 1;
  }
  return report;
}

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    out: DEFAULT_OUT
  };
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

function createGate(id, pass, details = {}) {
  return {
    id,
    pass: Boolean(pass),
    ...details
  };
}

function workflowRunsBeforePublish(workflow, command) {
  const commandIndex = workflow.indexOf(command);
  const publishIndex = workflow.indexOf('npm publish --access public');
  return commandIndex >= 0 && publishIndex >= 0 && commandIndex < publishIndex;
}

function collectScannedFiles(root) {
  const files = [];
  for (const target of SCAN_TARGETS) {
    const full = path.join(root, target);
    if (!existsSync(full)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) collectTextFiles(root, full, files);
    else if (isTextFile(full)) files.push({ path: slash(path.relative(root, full)), content: readIfExists(full) });
  }
  return files;
}

function collectTextFiles(root, dir, files) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relative = slash(path.relative(root, full));
    if (entry.isDirectory()) {
      if (shouldSkip(relative)) continue;
      collectTextFiles(root, full, files);
    } else if (isTextFile(full) && !shouldSkip(relative)) {
      files.push({ path: relative, content: readIfExists(full) });
    }
  }
}

function shouldSkip(relative) {
  const normalized = slash(relative);
  return SKIPPED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function readJson(filePath) {
  return JSON.parse(readIfExists(filePath) || '{}');
}

function readIfExists(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

function maskSecret(value) {
  const text = String(value);
  if (text.length <= 10) return '<redacted>';
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function slash(value) {
  return String(value).replace(/\\/gu, '/');
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  main();
}

export default main;
