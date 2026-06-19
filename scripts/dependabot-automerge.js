#!/usr/bin/env node
import { readFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HIGH_SEVERITIES = new Set(['high', 'critical']);

export function evaluateDependabotAutomerge({ audit = {}, event = {} } = {}) {
  const pullRequest = event.pull_request || {};
  const labels = new Set((pullRequest.labels || []).map((label) => label.name || label));
  const actor = pullRequest.user?.login || event.sender?.login || '';
  const hasHighSeverity = auditHasHighSeverity(audit);
  const nonBreaking = isNonBreakingUpdate({ labels, title: pullRequest.title || '' });
  const fromDependabot = actor === 'dependabot[bot]';
  const dependencyUpdate = labels.has('dependencies') || /^Bump\s+/iu.test(pullRequest.title || '');

  return {
    eligible: fromDependabot && dependencyUpdate && hasHighSeverity && nonBreaking,
    fromDependabot,
    dependencyUpdate,
    hasHighSeverity,
    nonBreaking
  };
}

export function auditHasHighSeverity(audit = {}) {
  const vulnerabilities = audit.vulnerabilities || {};
  if (Object.values(vulnerabilities).some((vulnerability) => (
    HIGH_SEVERITIES.has(String(vulnerability.severity || '').toLowerCase())
  ))) return true;
  const counts = audit.metadata?.vulnerabilities || {};
  return Number(counts.high || 0) > 0 || Number(counts.critical || 0) > 0;
}

export function isNonBreakingUpdate({ labels = new Set(), title = '' } = {}) {
  if (labels.has('semver-major')) return false;
  if (labels.has('semver-patch') || labels.has('semver-minor')) return true;
  const match = title.match(/\bfrom\s+v?(\d+)\.(\d+)\.(\d+)\s+to\s+v?(\d+)\.(\d+)\.(\d+)/i);
  if (!match) return false;
  return Number(match[1]) === Number(match[4]);
}

export default evaluateDependabotAutomerge;

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--audit') {
      index += 1;
      options.audit = argv[index];
    } else if (arg === '--event') {
      index += 1;
      options.event = argv[index];
    } else if (arg === '--github-output') {
      index += 1;
      options.githubOutput = argv[index];
    }
  }
  return options;
}

function readJson(filePath, fallback = {}) {
  if (!filePath) return fallback;
  return JSON.parse(readFileSync(path.resolve(filePath), 'utf8'));
}

function writeGithubOutput(filePath, result) {
  if (!filePath) return;
  appendFileSync(filePath, `eligible=${result.eligible ? 'true' : 'false'}\n`, 'utf8');
  appendFileSync(filePath, `hasHighSeverity=${result.hasHighSeverity ? 'true' : 'false'}\n`, 'utf8');
  appendFileSync(filePath, `nonBreaking=${result.nonBreaking ? 'true' : 'false'}\n`, 'utf8');
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = evaluateDependabotAutomerge({
      audit: readJson(options.audit),
      event: readJson(options.event)
    });
    writeGithubOutput(options.githubOutput, result);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
