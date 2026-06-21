#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_OUT = path.join('docs', 'release-notes', 'release-readiness-report.json');
const DIST_ENTRY = 'dist/omnicore.esm.js';
const DOC_URL = 'docs/public-release-evidence.md';
const NPM_REGISTRY_URL = 'https://registry.npmjs.org/omnicore';
const VERCEL_URL = 'https://omnicore.vercel.app/';
const GITHUB_PAGES_URL = 'https://wwu79090-png.github.io/omnicore/';

export function createReleaseReadinessReport(input = {}) {
  const packageJson = input.packageJson || {};
  const scripts = packageJson.scripts || {};
  const exportsMap = packageJson.exports || {};
  const rootExport = exportsMap['.'] || {};
  const readme = String(input.readme || '');
  const releaseWorkflow = String(input.releaseWorkflow || '');
  const distEntry = input.distEntry || {};
  const env = input.env || {};
  const publicTargets = input.publicTargets || {};
  const currentCommit = input.currentCommit || null;
  const latestRelease = publicTargets.latestRelease || {};
  const gates = [
    createGate('dist-entrypoint-main', packageJson.main === DIST_ENTRY, 'blocker', {
      actual: packageJson.main || null,
      expected: DIST_ENTRY
    }),
    createGate('dist-entrypoint-module', packageJson.module === DIST_ENTRY, 'blocker', {
      actual: packageJson.module || null,
      expected: DIST_ENTRY
    }),
    createGate('dist-entrypoint-export', rootExport.import === `./${DIST_ENTRY}`, 'blocker', {
      actual: rootExport.import || null,
      expected: `./${DIST_ENTRY}`
    }),
    createGate('dist-artifact-present', Boolean(distEntry.exists && distEntry.size > 0), 'blocker', {
      path: DIST_ENTRY,
      size: Number(distEntry.size || 0)
    }),
    createGate('readme-no-stale-metrics', !/590\/590|590 个测试|730\.71 kB/u.test(readme), 'blocker'),
    createGate('readme-discloses-publication-state', readme.includes('NPM 发布状态') && readme.includes('当前不是 OmniCore 引擎主页'), 'blocker'),
    createGate('readme-links-release-evidence', readme.includes(DOC_URL), 'blocker'),
    createGate('release-readiness-script', scripts['release:readiness'] === 'node scripts/release-readiness.js', 'blocker'),
    createGate('release-workflow-readiness-before-publish', workflowRunsBeforePublish(releaseWorkflow, 'npm run release:readiness'), 'blocker'),
    createGate('npm-auth-token-present', Boolean(env.NODE_AUTH_TOKEN || env.NPM_TOKEN), 'credential', {
      env: ['NODE_AUTH_TOKEN', 'NPM_TOKEN']
    }),
    createGate('vercel-token-present', Boolean(env.VERCEL_TOKEN), 'credential', {
      env: ['VERCEL_TOKEN']
    }),
    createGate('npm-registry-publication', publicTargets.npmRegistry?.status === 'published', 'external', {
      status: publicTargets.npmRegistry?.status || 'unknown',
      url: publicTargets.npmRegistry?.url || NPM_REGISTRY_URL
    }),
    createGate('vercel-homepage-sane', publicTargets.vercel?.ok === true, 'external', {
      status: publicTargets.vercel?.status || 'unknown',
      title: publicTargets.vercel?.title || null,
      url: publicTargets.vercel?.url || VERCEL_URL
    }),
    createGate('github-pages-enabled', publicTargets.githubPages?.ok === true, 'external', {
      status: publicTargets.githubPages?.status || 'unknown',
      url: publicTargets.githubPages?.url || GITHUB_PAGES_URL
    }),
    createGate('latest-release-targets-head', !currentCommit || latestRelease.targetCommitish === currentCommit, 'external', {
      currentCommit,
      targetCommitish: latestRelease.targetCommitish || null,
      url: latestRelease.url || null
    })
  ];
  const blockers = gates.filter((gate) => !gate.pass && gate.severity === 'blocker');
  const credentialGaps = gates.filter((gate) => !gate.pass && gate.severity === 'credential');
  const externalGaps = gates.filter((gate) => !gate.pass && gate.severity === 'external');

  return {
    schema: 'omnicore.release-readiness.v1',
    generatedAt: input.generatedAt || new Date().toISOString(),
    ok: blockers.length === 0,
    publicReleaseReady: blockers.length === 0 && credentialGaps.length === 0 && externalGaps.length === 0,
    gates,
    blockers,
    credentialGaps,
    externalGaps,
    nextActions: buildNextActions({ blockers, credentialGaps, externalGaps })
  };
}

export async function loadReleaseReadinessInput(root = process.cwd(), options = {}) {
  const projectRoot = path.resolve(root);
  return {
    packageJson: readJson(path.join(projectRoot, 'package.json')),
    readme: readIfExists(path.join(projectRoot, 'README.md')),
    releaseWorkflow: readIfExists(path.join(projectRoot, '.github', 'workflows', 'release.yml')),
    distEntry: statFile(path.join(projectRoot, DIST_ENTRY)),
    env: {
      NODE_AUTH_TOKEN: process.env.NODE_AUTH_TOKEN || '',
      NPM_TOKEN: process.env.NPM_TOKEN || '',
      VERCEL_TOKEN: process.env.VERCEL_TOKEN || ''
    },
    publicTargets: options.skipNetwork ? {} : await probePublicTargets(),
    currentCommit: readCurrentCommit(projectRoot)
  };
}

export async function probePublicTargets() {
  const [npmRegistry, vercel, githubPages, latestRelease] = await Promise.all([
    probeNpmRegistry(),
    probeHtmlTarget(VERCEL_URL, isEngineHomepage),
    probeHtmlTarget(GITHUB_PAGES_URL, isEngineHomepage),
    probeLatestRelease()
  ]);
  return { npmRegistry, vercel, githubPages, latestRelease };
}

export async function probeNpmRegistry(fetchImpl = fetch) {
  const result = await fetchWithTimeout(NPM_REGISTRY_URL, fetchImpl);
  if (result.status === 200) {
    let version = null;
    try {
      const json = JSON.parse(result.body || '{}');
      version = json['dist-tags']?.latest || null;
    } catch {
      version = null;
    }
    return { ok: true, status: 'published', version, url: NPM_REGISTRY_URL };
  }
  if (result.status === 404) return { ok: false, status: 'not-published', url: NPM_REGISTRY_URL };
  return { ok: false, status: result.status ? `http-${result.status}` : 'network-error', url: NPM_REGISTRY_URL, error: result.error || null };
}

export async function probeHtmlTarget(url, validator = isEngineHomepage, fetchImpl = fetch) {
  const result = await fetchWithTimeout(url, fetchImpl);
  const title = extractTitle(result.body || '');
  if (result.status !== 200) {
    return { ok: false, status: result.status ? `http-${result.status}` : 'network-error', url, title, error: result.error || null };
  }
  const ok = validator(result.body || '', title);
  return {
    ok,
    status: ok ? 'engine-homepage' : 'wrong-site',
    url,
    title
  };
}

export async function probeLatestRelease() {
  const result = spawnSync('gh', [
    'api',
    'repos/wwu79090-png/omnicore/releases/latest',
    '--jq',
    '{tag_name,html_url,target_commitish}'
  ], {
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.error || result.status !== 0) {
    return {
      ok: false,
      status: 'unavailable',
      error: result.error?.message || result.stderr || null
    };
  }
  try {
    const json = JSON.parse(result.stdout || '{}');
    return {
      ok: true,
      status: 'available',
      tagName: json.tag_name || null,
      url: json.html_url || null,
      targetCommitish: json.target_commitish || null
    };
  } catch (error) {
    return { ok: false, status: 'parse-error', error: error.message };
  }
}

export function writeReleaseReadinessReport(report, root = process.cwd(), out = DEFAULT_OUT) {
  const outFile = path.resolve(root, out);
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return outFile;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const root = path.resolve(options.root);
  const input = await loadReleaseReadinessInput(root, options);
  const report = createReleaseReadinessReport(input);
  const outFile = writeReleaseReadinessReport(report, root, options.out);
  console.log(`[OmniCore] release readiness report: ${outFile}`);
  if (report.blockers.length) {
    for (const gate of report.blockers) console.error(`[release:readiness] blocker ${gate.id}`);
  }
  if (report.credentialGaps.length) {
    for (const gate of report.credentialGaps) console.error(`[release:readiness] credential gap ${gate.id}`);
  }
  if (report.externalGaps.length) {
    for (const gate of report.externalGaps) console.error(`[release:readiness] external gap ${gate.id}: ${gate.status || ''}`);
  }
  if (options.strictPublication && (report.blockers.length || report.credentialGaps.length)) {
    process.exitCode = 1;
  }
  return report;
}

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    out: DEFAULT_OUT,
    strictPublication: false,
    skipNetwork: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      index += 1;
      options.root = argv[index];
    } else if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    } else if (arg === '--strict-publication') {
      options.strictPublication = true;
    } else if (arg === '--skip-network') {
      options.skipNetwork = true;
    }
  }
  return options;
}

function createGate(id, pass, severity, details = {}) {
  return {
    id,
    pass: Boolean(pass),
    severity,
    ...details
  };
}

function buildNextActions({ blockers, credentialGaps, externalGaps }) {
  const actions = [];
  for (const gate of blockers) {
    actions.push({ type: 'fix-local', gate: gate.id, message: `Fix local release configuration: ${gate.id}` });
  }
  for (const gate of credentialGaps) {
    actions.push({ type: 'provide-credential', gate: gate.id, message: `Provide required credential for ${gate.id}` });
  }
  for (const gate of externalGaps) {
    actions.push({ type: 'publish-external', gate: gate.id, message: `Complete external publication target: ${gate.id}` });
  }
  return actions;
}

function workflowRunsBeforePublish(workflow, command) {
  const commandIndex = workflow.indexOf(command);
  const publishIndex = workflow.indexOf('npm publish --access public');
  return commandIndex >= 0 && publishIndex >= 0 && commandIndex < publishIndex;
}

async function fetchWithTimeout(url, fetchImpl = fetch, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    return {
      status: response.status,
      body: await response.text()
    };
  } catch (error) {
    return {
      status: 0,
      body: '',
      error: error.message
    };
  } finally {
    clearTimeout(timer);
  }
}

function isEngineHomepage(body, title) {
  const text = `${title}\n${body}`;
  return /OmniCore v1\.0\.0|2D-first web game engine|PixiJS rendering|OmniCore 是一个 HTML5/u.test(text)
    && !/Digital Banking|Fintech Solutions/u.test(text);
}

function extractTitle(html) {
  return String(html).match(/<title[^>]*>(.*?)<\/title>/isu)?.[1]?.replace(/\s+/gu, ' ').trim() || null;
}

function readCurrentCommit(root) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function statFile(filePath) {
  if (!existsSync(filePath)) return { exists: false, size: 0 };
  const stat = statSync(filePath);
  return { exists: true, size: stat.size, mtimeMs: stat.mtimeMs };
}

function readJson(filePath) {
  return JSON.parse(readIfExists(filePath) || '{}');
}

function readIfExists(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  main();
}

export default main;
