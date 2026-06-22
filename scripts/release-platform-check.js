#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function createReleasePlatformReadinessReport({
  generatedAt = new Date().toISOString(),
  distExists = existsSync(path.resolve('dist', 'omnicore.esm.js')),
  publishDryRunOk = readPublishDryRunOk(),
  github = { authenticated: false, user: null },
  npm = { authenticated: false, user: null, packageAvailable: false },
  vercel = { authenticated: false, user: null, projectLinked: false }
} = {}) {
  const checks = [
    createCheck('github-auth', github.authenticated, 'GitHub CLI is authenticated.', 'Run gh auth login.'),
    createCheck('npm-auth', npm.authenticated, 'NPM CLI is authenticated.', 'Run npm login before npm publish.'),
    createCheck('npm-package-availability', npm.packageAvailable, 'NPM package name/version is publishable.', 'Check npm view omnicore and version availability.'),
    createCheck('vercel-auth', vercel.authenticated, 'Vercel CLI is authenticated.', 'Run vercel login or provide VERCEL_TOKEN.'),
    createCheck('vercel-project-link', vercel.projectLinked, 'Vercel project is linked.', 'Run vercel link before production deploy.'),
    createCheck('dist-artifact', distExists, 'dist/omnicore.esm.js exists.', 'Run npm run build.'),
    createCheck('publish-dry-run', publishDryRunOk, 'npm publish dry-run evidence is clean.', 'Run npm run publish:dry-run.')
  ];
  const blockers = checks.filter((check) => !check.ok).map((check) => ({
    id: check.id,
    action: check.recovery
  }));
  return {
    format: 'OmniCore.ReleasePlatformReadiness',
    version: 1,
    generatedAt,
    ok: blockers.length === 0,
    accounts: {
      github: { user: github.user || null, authenticated: Boolean(github.authenticated) },
      npm: { user: npm.user || null, authenticated: Boolean(npm.authenticated), packageAvailable: Boolean(npm.packageAvailable) },
      vercel: { user: vercel.user || null, authenticated: Boolean(vercel.authenticated), projectLinked: Boolean(vercel.projectLinked) }
    },
    checks,
    blockers,
    nextActions: blockers.length === 0
      ? ['npm publish --access public', 'vercel --prod']
      : blockers.map((blocker) => blocker.action)
  };
}

export function probeReleasePlatformReadiness({ root = process.cwd(), generatedAt = new Date().toISOString() } = {}) {
  const githubProbe = runCommand('gh auth status', root);
  const npmWhoami = runCommand('npm whoami', root);
  const npmView = runCommand('npm view omnicore version', root);
  const vercelWhoami = runCommand('vercel whoami', root);
  const vercelProject = existsSync(path.resolve(root, '.vercel', 'project.json'));
  return createReleasePlatformReadinessReport({
    generatedAt,
    distExists: existsSync(path.resolve(root, 'dist', 'omnicore.esm.js')),
    publishDryRunOk: readPublishDryRunOk(root),
    github: {
      authenticated: githubProbe.ok,
      user: parseGithubUser(githubProbe.output)
    },
    npm: {
      authenticated: npmWhoami.ok,
      user: npmWhoami.ok ? npmWhoami.output.trim().split(/\s+/u)[0] : null,
      packageAvailable: !npmView.ok
    },
    vercel: {
      authenticated: vercelWhoami.ok,
      user: vercelWhoami.ok ? vercelWhoami.output.trim().split(/\s+/u).at(-1) : null,
      projectLinked: vercelProject
    }
  });
}

export function writeReleasePlatformReadinessReport(
  report,
  out = path.join('docs', 'release-notes', 'platform-readiness-report.json')
) {
  const outFile = path.resolve(out);
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return outFile;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = probeReleasePlatformReadiness({ root: options.root, generatedAt: options.generatedAt });
  const outFile = writeReleasePlatformReadinessReport(report, path.resolve(options.root, options.out));
  console.log(`[OmniCore] release platform readiness ${report.ok ? 'ready' : 'blocked'}: ${outFile}`);
  for (const blocker of report.blockers) console.log(`[platform-check] ${blocker.id}: ${blocker.action}`);
  if (options.strict && !report.ok) process.exitCode = 1;
  return report;
}

function createCheck(id, ok, message, recovery) {
  return {
    id,
    ok: Boolean(ok),
    message,
    recovery
  };
}

function runCommand(commandLine, root) {
  const result = spawnSync('cmd.exe', ['/d', '/s', '/c', commandLine], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  return {
    ok: result.status === 0,
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`.trim()
  };
}

function readPublishDryRunOk(root = process.cwd()) {
  const reportFile = path.resolve(root, 'docs', 'release-notes', 'npm-publish-dry-run-report.json');
  if (!existsSync(reportFile)) return false;
  try {
    return JSON.parse(readFileSync(reportFile, 'utf8')).ok === true;
  } catch {
    return false;
  }
}

function parseGithubUser(output = '') {
  const match = output.match(/account\s+([^\s]+)/iu);
  return match?.[1] || null;
}

function parseArgs(argv = []) {
  const options = {
    root: process.cwd(),
    out: path.join('docs', 'release-notes', 'platform-readiness-report.json'),
    strict: false,
    generatedAt: undefined
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      index += 1;
      options.root = path.resolve(argv[index]);
    } else if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--generated-at') {
      index += 1;
      options.generatedAt = argv[index];
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
