#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildMarketReadiness } from './generate-quality-report.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_VERIFY_TIMEOUT_MS = 120_000;
const DEFAULT_VERIFY_SCRIPTS = ['lint', 'test:contract', 'benchmark:ci'];
const VERIFY_OUTPUT_LIMIT = 24_000;

export function createProductionReadyReport({
  projectRoot = root,
  verify = false,
  verificationScripts = [],
  verificationCommands = [],
  verificationTimeoutMs = DEFAULT_VERIFY_TIMEOUT_MS,
  generatedAt = new Date().toISOString()
} = {}) {
  const packageJson = readPackage(projectRoot);
  const srcRoot = path.join(projectRoot, 'src');
  const changelog = existsSync(path.join(projectRoot, 'CHANGELOG.md'))
    ? readFileSync(path.join(projectRoot, 'CHANGELOG.md'), 'utf8')
    : '';
  const findings = [];

  for (const file of walk(srcRoot)) {
    const source = stripComments(readFileSync(file, 'utf8'));
    const relative = path.relative(projectRoot, file).replace(/\\/g, '/');
    collectPattern(findings, source, relative, /\bdebugger\b/g, 'debugger statement remains in source');
    collectPattern(findings, source, relative, /console\.log\(/g, 'console.log remains in source');
  }

  if (!changelog.includes(packageJson.version)) {
    findings.push({
      level: 'warning',
      file: 'CHANGELOG.md',
      message: `package version ${packageJson.version} is not mentioned in CHANGELOG.md`
    });
  }

  const marketReadiness = buildMarketReadiness({
    projectRoot,
    packageSummary: {
      name: packageJson.name,
      version: packageJson.version,
      postbuild: packageJson.scripts?.postbuild || null,
      scripts: packageJson.scripts || {}
    }
  });

  for (const missing of marketReadiness.releaseGates.missing) {
    findings.push({
      level: 'error',
      file: 'package.json',
      message: `missing release gate script: ${missing}`
    });
  }

  for (const warning of marketReadiness.apiStability.warnings) {
    findings.push({
      level: 'warning',
      file: 'src/index.js',
      message: warning
    });
  }

  const verification = buildVerificationReport({
    projectRoot,
    scripts: packageJson.scripts || {},
    verify,
    verificationScripts,
    verificationCommands,
    verificationTimeoutMs
  });

  for (const failed of verification.results.filter((item) => !item.ok)) {
    findings.push({
      level: 'error',
      file: 'verification',
      message: `verification command failed: ${failed.name}`,
      command: failed.command,
      status: failed.status,
      signal: failed.signal,
      timedOut: failed.timedOut
    });
  }

  return {
    generatedAt,
    version: packageJson.version,
    ready: findings.filter((item) => item.level === 'error').length === 0,
    score: marketReadiness.score,
    marketReadiness,
    verification,
    findings
  };
}

export function generateProductionReadyReport(options = {}) {
  const projectRoot = options.projectRoot || root;
  const report = createProductionReadyReport({ ...options, projectRoot });
  const outFile = writeProductionReadyReport(report, {
    out: options.out,
    projectRoot
  });
  return { report, outFile };
}

export function writeProductionReadyReport(report, {
  out,
  projectRoot = root
} = {}) {
  const outFile = out
    ? path.resolve(out)
    : path.join(projectRoot, 'docs', 'release-notes', 'production-ready-report.json');
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return outFile;
}

export function runVerificationCommands({
  commands = [],
  cwd = root,
  timeoutMs = DEFAULT_VERIFY_TIMEOUT_MS
} = {}) {
  return commands.map((commandSpec) => runVerificationCommand(commandSpec, { cwd, timeoutMs }));
}

function collectPattern(findings, source, relative, pattern, message) {
  const matches = source.match(pattern);
  if (!matches) return;
  findings.push({
    level: message.includes('debugger') ? 'error' : 'warning',
    file: relative,
    message,
    count: matches.length
  });
}

function buildVerificationReport({
  projectRoot,
  scripts,
  verify,
  verificationScripts,
  verificationCommands,
  verificationTimeoutMs
}) {
  const commands = resolveVerificationCommands({
    scripts,
    verify,
    verificationScripts,
    verificationCommands
  });
  const enabled = Boolean(verify || commands.length);
  const results = enabled
    ? runVerificationCommands({
      commands,
      cwd: projectRoot,
      timeoutMs: verificationTimeoutMs
    })
    : [];
  const failed = results.filter((item) => !item.ok).map((item) => item.name);
  return {
    enabled,
    ok: failed.length === 0,
    failed,
    defaultScripts: enabled && verificationScripts.length === 0 && verificationCommands.length === 0
      ? [...DEFAULT_VERIFY_SCRIPTS]
      : [],
    results
  };
}

function resolveVerificationCommands({
  scripts,
  verify,
  verificationScripts = [],
  verificationCommands = []
}) {
  const shouldUseDefaults = verify
    && verificationScripts.length === 0
    && verificationCommands.length === 0;
  const scriptNames = shouldUseDefaults ? DEFAULT_VERIFY_SCRIPTS : verificationScripts;
  return [
    ...scriptNames.map((name) => makeNpmScriptCommand(name, scripts)),
    ...verificationCommands
  ];
}

function makeNpmScriptCommand(name, scripts) {
  if (!scripts[name]) {
    return {
      name,
      missingScript: true,
      command: `npm run ${name}`,
      shell: true
    };
  }
  return {
    name,
    command: `npm run ${name}`,
    shell: true
  };
}

function runVerificationCommand(commandSpec, { cwd, timeoutMs }) {
  const startedAt = Date.now();
  const command = formatCommand(commandSpec);
  if (commandSpec.missingScript) {
    return {
      name: commandSpec.name,
      command,
      ok: false,
      status: null,
      signal: null,
      timedOut: false,
      durationMs: 0,
      stdout: '',
      stderr: '',
      stdoutTruncated: false,
      stderrTruncated: false,
      error: `package script is missing: ${commandSpec.name}`
    };
  }

  const result = commandSpec.shell
    ? spawnSync(commandSpec.command, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      shell: true,
      timeout: timeoutMs,
      windowsHide: true
    })
    : spawnSync(commandSpec.command, commandSpec.args || [], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: timeoutMs,
      windowsHide: true
    });
  const stdout = limitOutput(result.stdout || '');
  const stderr = limitOutput(result.stderr || '');
  const timedOut = result.error?.code === 'ETIMEDOUT';
  return {
    name: commandSpec.name,
    command,
    ok: !result.error && result.status === 0,
    status: result.status,
    signal: result.signal || null,
    timedOut,
    durationMs: Date.now() - startedAt,
    stdout: stdout.text,
    stderr: stderr.text,
    stdoutTruncated: stdout.truncated,
    stderrTruncated: stderr.truncated,
    error: result.error ? result.error.message : null
  };
}

function parseArgs(argv) {
  const options = {
    verificationCommands: [],
    verificationScripts: []
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    } else if (arg === '--verify') {
      options.verify = true;
    } else if (arg === '--verify-script') {
      index += 1;
      options.verify = true;
      options.verificationScripts.push(argv[index]);
    } else if (arg === '--verify-command') {
      index += 1;
      options.verify = true;
      options.verificationCommands.push(parseVerifyCommand(argv[index], options.verificationCommands.length));
    } else if (arg === '--verify-timeout-ms') {
      index += 1;
      options.verificationTimeoutMs = Number(argv[index]);
    }
  }
  return options;
}

function parseVerifyCommand(raw, index) {
  const splitAt = raw.indexOf('=');
  if (splitAt <= 0) {
    return {
      name: `command-${index + 1}`,
      command: raw,
      shell: true
    };
  }
  return {
    name: raw.slice(0, splitAt).trim(),
    command: raw.slice(splitAt + 1).trim(),
    shell: true
  };
}

function readPackage(projectRoot) {
  return JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
}

function walk(dir) {
  const output = [];
  if (!existsSync(dir)) return output;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) output.push(...walk(full));
    else if (/\.(js|mjs)$/.test(entry)) output.push(full);
  }
  return output;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function formatCommand(commandSpec) {
  if (commandSpec.shell) return commandSpec.command;
  return [commandSpec.command, ...(commandSpec.args || [])].join(' ');
}

function limitOutput(output) {
  if (output.length <= VERIFY_OUTPUT_LIMIT) {
    return { text: output, truncated: false };
  }
  return {
    text: output.slice(output.length - VERIFY_OUTPUT_LIMIT),
    truncated: true
  };
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

export function main(argv = process.argv.slice(2)) {
  const { report, outFile } = generateProductionReadyReport(parseArgs(argv));
  console.log(`[OmniCore] production audit written: ${outFile}`);
  if (report.verification.enabled) {
    const status = report.verification.ok ? 'passed' : 'failed';
    console.log(`[OmniCore] verification ${status}: ${report.verification.results.length} command(s)`);
  }
  if (report.findings.length) {
    report.findings.forEach((item) => console.log(`[${item.level}] ${item.file}: ${item.message}`));
  }
  if (!report.ready) process.exitCode = 1;
  return report;
}

if (isCli()) {
  main();
}
