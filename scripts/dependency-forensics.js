#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const LIFECYCLE_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly'];
const DEFAULT_GENERATED_AT = '2026-06-20T00:00:00.000Z';
const DEFAULT_ALLOWED_HOSTS = new Set([
  'registry.npmjs.org',
  'www.npmjs.com',
  'github.com',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',
  'api.github.com',
  'playwright.azureedge.net',
  'cdn.playwright.dev',
  'nodejs.org',
  'npm.taobao.org',
  'npmmirror.com'
]);
const STANDARD_INSTALLER_FILES = [
  'install.js',
  'install.mjs',
  'postinstall.js',
  'postinstall.mjs',
  'preinstall.js',
  'preinstall.mjs',
  'prepare.js',
  'prepare.mjs',
  'scripts/install.js',
  'scripts/postinstall.js',
  'bin/install.js'
];

function resolveGeneratedAt() {
  if (process.env.OMNICORE_GENERATED_AT) return process.env.OMNICORE_GENERATED_AT;
  if (process.env.SOURCE_DATE_EPOCH) {
    const epoch = Number(process.env.SOURCE_DATE_EPOCH);
    if (Number.isFinite(epoch)) return new Date(epoch * 1000).toISOString();
  }
  return DEFAULT_GENERATED_AT;
}

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    networkThreshold: 3
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      options.root = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg === '--network-threshold') {
      options.networkThreshold = Number(argv[index + 1]);
      index += 1;
    }
  }

  return options;
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readConfig(root) {
  const config = readJson(path.join(root, 'config', 'dependency-forensics.json'), {});
  return {
    allowedHosts: new Set([
      ...DEFAULT_ALLOWED_HOSTS,
      ...(Array.isArray(config.allowedHosts) ? config.allowedHosts : [])
    ]),
    deniedHosts: new Set(Array.isArray(config.deniedHosts) ? config.deniedHosts : [])
  };
}

function listPackageDirs(nodeModulesDir, packageDirs = []) {
  if (!existsSync(nodeModulesDir)) return packageDirs;

  for (const entry of readdirSync(nodeModulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '.bin' || entry.name.startsWith('.cache')) continue;
    const entryPath = path.join(nodeModulesDir, entry.name);
    if (entry.name.startsWith('@')) {
      for (const scoped of readdirSync(entryPath, { withFileTypes: true })) {
        if (!scoped.isDirectory()) continue;
        const scopedPath = path.join(entryPath, scoped.name);
        if (existsSync(path.join(scopedPath, 'package.json'))) packageDirs.push(scopedPath);
        listPackageDirs(path.join(scopedPath, 'node_modules'), packageDirs);
      }
      continue;
    }

    if (existsSync(path.join(entryPath, 'package.json'))) packageDirs.push(entryPath);
    listPackageDirs(path.join(entryPath, 'node_modules'), packageDirs);
  }

  return packageDirs;
}

function extractHosts(content) {
  const hosts = new Set();
  const urlPattern = /\bhttps?:\/\/([^/\s'"`)]+)/gi;
  let match = urlPattern.exec(content);
  while (match) {
    hosts.add(match[1].toLowerCase());
    match = urlPattern.exec(content);
  }
  return [...hosts];
}

function unauthorizedHosts(hosts, allowedHosts) {
  return hosts.filter((host) => !allowedHosts.has(host));
}

function deniedLifecycleHosts(hosts, deniedHosts) {
  return hosts.filter((host) => {
    for (const denied of deniedHosts) {
      const normalized = String(denied).toLowerCase();
      if (host === normalized || host.endsWith(`.${normalized}`)) return true;
    }
    return false;
  });
}

function hasRemoteShellExecution(command) {
  return /\b(curl|wget|iwr|Invoke-WebRequest)\b/i.test(command)
    && /(\|\s*(bash|sh|powershell|pwsh|node)|\b(bash|sh|powershell|pwsh)\b\s+-c)/i.test(command);
}

function hasNetworkExecution(command) {
  return /\b(curl|wget|iwr|Invoke-WebRequest)\b/i.test(command)
    || /\b(node|deno)\b\s+-e\b/i.test(command)
    || /\b(fetch|http\.get|https\.get|request)\s*\(/i.test(command);
}

function commandInstallerCandidates(command) {
  const candidates = new Set(STANDARD_INSTALLER_FILES);
  const scriptPattern = /(?:^|\s)(?:node\s+)?([./\w-]*(?:install|postinstall|preinstall|prepare)[\w./-]*\.m?js)\b/gi;
  let match = scriptPattern.exec(command);
  while (match) {
    candidates.add(match[1].replace(/^['"]|['"]$/g, ''));
    match = scriptPattern.exec(command);
  }
  return [...candidates];
}

function safePackageFile(packageRoot, relativeFile) {
  const resolved = path.resolve(packageRoot, relativeFile);
  if (!resolved.startsWith(path.resolve(packageRoot))) return null;
  if (!existsSync(resolved)) return null;
  if (!statSync(resolved).isFile()) return null;
  return resolved;
}

function lifecycleEntries(pkg) {
  const scripts = pkg.scripts || {};
  return LIFECYCLE_SCRIPTS
    .filter((name) => typeof scripts[name] === 'string')
    .map((name) => ({ name, command: scripts[name] }));
}

function inspectPackage(packageRoot, allowedHosts, deniedHosts, networkThreshold) {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  const pkg = readJson(packageJsonPath, {});
  const name = pkg.name || path.basename(packageRoot);
  const version = pkg.version || '0.0.0';
  const findings = [];
  const observedLifecycle = [];

  for (const entry of lifecycleEntries(pkg)) {
    observedLifecycle.push(entry);
    const hosts = extractHosts(entry.command);
    const denied = deniedLifecycleHosts(hosts, deniedHosts);
    const unapproved = unauthorizedHosts(hosts, allowedHosts);
    if (denied.length > 0) {
      findings.push({
        severity: 'high',
        code: 'denied-lifecycle-host',
        reason: `${entry.name} references explicitly denied hosts`,
        detail: entry.command,
        lifecycle: entry.name,
        hosts: denied
      });
      continue;
    }
    if (hasRemoteShellExecution(entry.command)) {
      findings.push({
        severity: 'high',
        code: 'remote-shell-execution',
        reason: `${entry.name} pipes a remote download into a shell`,
        detail: entry.command,
        lifecycle: entry.name,
        hosts: unapproved.length ? unapproved : hosts
      });
      continue;
    }

    if (hasNetworkExecution(entry.command) && unapproved.length > 0) {
      findings.push({
        severity: 'high',
        code: 'unapproved-lifecycle-network',
        reason: `${entry.name} performs network access to unapproved hosts`,
        detail: entry.command,
        lifecycle: entry.name,
        hosts: unapproved
      });
    }

    for (const candidate of commandInstallerCandidates(entry.command)) {
      const installerPath = safePackageFile(packageRoot, candidate);
      if (!installerPath) continue;
      const installerContent = readFileSync(installerPath, 'utf8');
      const installerHosts = extractHosts(installerContent);
      const installerDenied = deniedLifecycleHosts(installerHosts, deniedHosts);
      const installerUnapproved = unauthorizedHosts(installerHosts, allowedHosts);
      if (installerDenied.length > 0) {
        findings.push({
          severity: 'high',
          code: 'denied-lifecycle-host',
          reason: `${entry.name} installer references explicitly denied hosts`,
          detail: path.relative(packageRoot, installerPath),
          lifecycle: entry.name,
          hosts: installerDenied
        });
      }
      if (installerUnapproved.length > networkThreshold) {
        findings.push({
          severity: 'high',
          code: 'excessive-unapproved-network',
          reason: `${entry.name} installer references ${installerUnapproved.length} unapproved network hosts`,
          detail: path.relative(packageRoot, installerPath),
          lifecycle: entry.name,
          hosts: installerUnapproved
        });
      }
    }
  }

  return {
    name,
    version,
    path: path.relative(process.cwd(), packageRoot),
    packageRoot,
    lifecycle: observedLifecycle,
    findings
  };
}

function lockfileVersion(root, packageName) {
  const lock = readJson(path.join(root, 'package-lock.json'), {});
  const packages = lock.packages || {};
  const suffix = `node_modules/${packageName}`.replaceAll('\\', '/');
  const entry = Object.entries(packages).find(([key]) => key.replaceAll('\\', '/').endsWith(suffix));
  return entry?.[1]?.version || null;
}

function buildMarkdownReport({ root, scanned, packages, highFindings, generatedAt }) {
  const lines = [
    '# OmniCore Dependency Forensics Report',
    '',
    `- Generated: ${generatedAt}`,
    `- Root: ${root}`,
    `- Packages scanned: ${scanned}`,
    `- Packages with lifecycle scripts: ${packages.filter((pkg) => pkg.lifecycle.length > 0).length}`,
    `- High-risk findings: ${highFindings.length}`,
    ''
  ];

  if (highFindings.length === 0) {
    lines.push('## HIGH RISK', '', 'No HIGH RISK findings detected.', '');
  } else {
    lines.push('## HIGH RISK', '');
    for (const finding of highFindings) {
      lines.push(`- **${finding.name}@${finding.version}** - ${finding.code}: ${finding.reason}`);
      lines.push(`  - lifecycle: ${finding.lifecycle}`);
      lines.push(`  - detail: ${finding.detail}`);
      lines.push(`  - hosts: ${finding.hosts.length ? finding.hosts.join(', ') : 'none'}`);
    }
    lines.push('');
  }

  const lifecyclePackages = packages.filter((pkg) => pkg.lifecycle.length > 0);
  lines.push('## Lifecycle Script Inventory', '');
  if (lifecyclePackages.length === 0) {
    lines.push('No dependency lifecycle scripts found.');
  } else {
    for (const pkg of lifecyclePackages) {
      lines.push(`- ${pkg.name}@${pkg.version}: ${pkg.lifecycle.map((entry) => entry.name).join(', ')}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function writeReports(root, packages) {
  const securityDir = path.join(root, 'docs', 'security');
  mkdirSync(securityDir, { recursive: true });
  const generatedAt = resolveGeneratedAt();
  const highFindings = packages.flatMap((pkg) => pkg.findings
    .filter((finding) => finding.severity === 'high')
    .map((finding) => ({
      name: pkg.name,
      version: pkg.version,
      packagePath: pkg.path,
      ...finding
    })));
  const markdown = buildMarkdownReport({
    root,
    scanned: packages.length,
    packages,
    highFindings,
    generatedAt
  });
  const locked = highFindings.map((finding) => ({
    name: finding.name,
    version: lockfileVersion(root, finding.name) || finding.version,
    packagePath: finding.packagePath,
    severity: finding.severity,
    code: finding.code,
    reason: `${finding.lifecycle}: ${finding.reason}`,
    recommendedAction: `Keep ${finding.name}@${lockfileVersion(root, finding.name) || finding.version} locked until the lifecycle script is reviewed or replaced.`
  }));
  writeFileSync(path.join(securityDir, 'dependency-forensics-latest.md'), markdown);
  writeFileSync(path.join(securityDir, 'dependency-forensics-lock.json'), JSON.stringify({
    generatedAt,
    root,
    locked
  }, null, 2));
  return highFindings;
}

function mtimeMs(file) {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function outputsAreFresh(outputs, inputs) {
  const outputTimes = outputs.map(mtimeMs);
  if (outputTimes.some((time) => time <= 0)) return false;
  const newestInput = Math.max(...inputs.map(mtimeMs));
  return Math.min(...outputTimes) >= newestInput;
}

function cleanForensicsReport(root) {
  const reportPath = path.join(root, 'docs', 'security', 'dependency-forensics-latest.md');
  const report = existsSync(reportPath) ? readFileSync(reportPath, 'utf8') : '';
  return report.includes('- High-risk findings: 0');
}

function run() {
  const options = parseArgs(process.argv.slice(2));
  const root = path.resolve(options.root);
  const outputs = [
    path.join(root, 'docs', 'security', 'dependency-forensics-latest.md'),
    path.join(root, 'docs', 'security', 'dependency-forensics-lock.json')
  ];
  const inputs = [
    path.resolve(process.argv[1] || 'scripts/dependency-forensics.js'),
    path.join(root, 'package.json'),
    path.join(root, 'package-lock.json'),
    path.join(root, 'config', 'dependency-forensics.json')
  ];
  if (cleanForensicsReport(root) && outputsAreFresh(outputs, inputs)) {
    console.log('[dependency-forensics] cached clean report; 0 high-risk findings.');
    return;
  }

  const { allowedHosts, deniedHosts } = readConfig(root);
  const packageDirs = listPackageDirs(path.join(root, 'node_modules'));
  const packages = packageDirs.map((packageRoot) => inspectPackage(
    packageRoot,
    allowedHosts,
    deniedHosts,
    options.networkThreshold
  ));
  const highFindings = writeReports(root, packages);

  if (highFindings.length > 0) {
    console.error(`[dependency-forensics] HIGH RISK findings: ${highFindings.length}`);
    console.error('[dependency-forensics] See docs/security/dependency-forensics-latest.md');
    process.exitCode = 1;
    return;
  }

  console.log(`[dependency-forensics] scanned ${packages.length} packages; 0 high-risk findings.`);
}

run();
