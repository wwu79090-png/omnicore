#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const VALID_LABELS = new Set(['bug', 'fix', 'test', 'tests', 'regression', 'security']);

export function analyzeContributorPromotion({
  contributor = 'unknown',
  pullRequests = [],
  threshold = 20
} = {}) {
  const valid = pullRequests.filter(isValidPullRequest);
  const recommendation = valid.length >= threshold ? 'promote-to-triage' : 'keep-contributor';
  return {
    contributor,
    validPullRequests: valid.length,
    threshold,
    recommendation,
    permission: recommendation === 'promote-to-triage' ? 'triage' : 'none',
    evidence: valid.map((pullRequest) => pullRequest.number).filter(Boolean)
  };
}

export function isValidPullRequest(pullRequest = {}) {
  if (pullRequest.merged === false || pullRequest.state === 'closed-unmerged') return false;
  const labels = new Set((pullRequest.labels || []).map((label) => String(label).toLowerCase()));
  const hasValidLabel = [...labels].some((label) => VALID_LABELS.has(label));
  const files = (pullRequest.changedFiles || pullRequest.files || []).map((file) => String(file).replace(/\\/gu, '/'));
  const hasTest = files.some((file) => /(^|\/)tests?(\/|$)|\.test\./iu.test(file));
  const hasSource = files.some((file) => /(^|\/)src\//iu.test(file));
  return hasValidLabel && (hasTest || hasSource);
}

function runCli() {
  const inputPath = process.argv.includes('--input')
    ? process.argv[process.argv.indexOf('--input') + 1]
    : null;
  if (!inputPath) {
    console.log(JSON.stringify(analyzeContributorPromotion(), null, 2));
    return;
  }
  const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  console.log(JSON.stringify(analyzeContributorPromotion(payload), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runCli();

export default analyzeContributorPromotion;
