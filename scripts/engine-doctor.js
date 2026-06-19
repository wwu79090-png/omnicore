#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildMarketCompetitivenessScorecard,
  buildMarketReadiness,
  buildNon3DMarketScorecard
} from './generate-quality-report.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FOUR_MB = 4 * 1024 * 1024;

export function createEngineDoctorReport({
  projectRoot = root,
  generatedAt = new Date().toISOString()
} = {}) {
  const normalizedRoot = path.resolve(projectRoot);
  const packageSummary = readPackageSummary(normalizedRoot);
  const marketReadiness = buildMarketReadiness({ projectRoot: normalizedRoot, packageSummary });
  const non3DMarketScorecard = buildNon3DMarketScorecard({ projectRoot: normalizedRoot, packageSummary });
  const marketCompetitiveness = buildMarketCompetitivenessScorecard({ projectRoot: normalizedRoot, packageSummary });
  const categories = {
    releaseGates: evaluateReleaseGates(marketReadiness),
    non3DStrength: evaluateScorecard(non3DMarketScorecard, 'non-3D market scorecard'),
    marketProof: evaluateScorecard(marketCompetitiveness, 'market competitiveness'),
    wechatPackage: evaluateWechatPackage(normalizedRoot),
    verificationEvidence: evaluateVerificationEvidence(normalizedRoot)
  };
  const nextActions = buildNextActions(categories);
  const score = nextActions.length === 0 ? 100 : calculateDoctorScore(categories);
  return {
    generatedAt,
    ready: nextActions.length === 0,
    score,
    categories,
    nextActions
  };
}

export function writeEngineDoctorMarkdown(report, outFile) {
  const lines = [
    '# OmniCore Engine Doctor',
    '',
    `Generated: ${report.generatedAt}`,
    `Ready: ${report.ready ? 'yes' : 'no'}`,
    `Score: ${report.score}`,
    '',
    '| Category | Status | Score | Detail |',
    '| --- | --- | ---: | --- |'
  ];
  for (const [name, category] of Object.entries(report.categories)) {
    lines.push(`| ${name} | ${category.ok ? 'ok' : category.severity || 'error'} | ${category.score ?? 0} | ${category.message || ''} |`);
  }
  if (report.nextActions.length) {
    lines.push('', '## Next Actions');
    for (const action of report.nextActions) lines.push(`- ${action.command}: ${action.reason}`);
  }
  const markdown = `${lines.join('\n')}\n`;
  if (outFile) writeText(path.resolve(outFile), markdown);
  return markdown;
}

export function runEngineDoctorCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = createEngineDoctorReport({
    projectRoot: options.root || root
  });
  const markdown = writeEngineDoctorMarkdown(report, options.out);
  if (options.json) writeText(path.resolve(options.json), `${JSON.stringify(report, null, 2)}\n`);
  if (!options.out && !options.json) process.stdout.write(markdown);
  return report;
}

function readPackageSummary(projectRoot) {
  const file = path.join(projectRoot, 'package.json');
  if (!existsSync(file)) return { scripts: {} };
  try {
    const json = JSON.parse(readFileSync(file, 'utf8'));
    return {
      name: json.name || null,
      version: json.version || null,
      scripts: json.scripts || {}
    };
  } catch {
    return { scripts: {} };
  }
}

function evaluateReleaseGates(marketReadiness) {
  const risks = marketReadiness.risks || [];
  return {
    ok: risks.length === 0 && marketReadiness.score >= 100,
    score: marketReadiness.score,
    severity: risks.length ? 'error' : 'info',
    message: risks.length ? risks.join('; ') : 'release gates and platform coverage are complete'
  };
}

function evaluateScorecard(scorecard, label) {
  const risks = scorecard.risks || [];
  return {
    ok: Boolean(scorecard.allAboveTarget),
    score: scorecard.overallScore,
    severity: risks.length ? 'warning' : 'info',
    message: risks.length ? risks.join('; ') : `${label} is above target`
  };
}

function evaluateWechatPackage(projectRoot) {
  const dir = path.join(projectRoot, 'dist', 'wechat');
  if (!existsSync(dir)) {
    return {
      ok: false,
      severity: 'error',
      score: 0,
      bytes: 0,
      fileCount: 0,
      message: 'dist/wechat is missing'
    };
  }
  const files = listFiles(dir);
  const bytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
  const reportFile = path.join(dir, 'wechat-build-report.json');
  const buildReport = readJson(reportFile);
  const reportPass = buildReport?.pass === true;
  const ok = files.length > 0 && bytes > 0 && bytes <= FOUR_MB && reportPass;
  return {
    ok,
    severity: ok ? 'info' : 'error',
    score: ok ? 100 : 0,
    bytes,
    fileCount: files.length,
    limitBytes: FOUR_MB,
    message: ok ? 'WeChat package is present and under 4MB' : 'WeChat package is missing, empty, too large, or lacks a passing report'
  };
}

function evaluateVerificationEvidence(projectRoot) {
  const production = readJson(path.join(projectRoot, 'docs', 'release-notes', 'production-ready-report.json'));
  const securityDoc = existsSync(path.join(projectRoot, 'docs', 'security', 'security.md'));
  const caseStudies = countCaseStudies(path.join(projectRoot, 'website', 'case-studies.html'));
  const ok = production?.ready === true && securityDoc && caseStudies >= 3;
  return {
    ok,
    severity: ok ? 'info' : 'error',
    score: ok ? 100 : 0,
    productionReady: production?.ready === true,
    securityDoc,
    caseStudies,
    message: ok ? 'release, security, and case-study evidence are present' : 'release evidence is incomplete'
  };
}

function buildNextActions(categories) {
  const actions = [];
  if (!categories.wechatPackage.ok) {
    actions.push({
      command: 'npm run build:wechat && npm run performance:budget',
      reason: categories.wechatPackage.message
    });
  }
  if (!categories.verificationEvidence.ok) {
    actions.push({
      command: 'npm run production-ready -- --verify',
      reason: categories.verificationEvidence.message
    });
  }
  if (!categories.non3DStrength.ok) {
    actions.push({
      command: 'node scripts/generate-quality-report.js --out quality-report.json',
      reason: categories.non3DStrength.message
    });
  }
  if (!categories.marketProof.ok) {
    actions.push({
      command: 'npm run marketplace:validate && npm run performance:budget',
      reason: categories.marketProof.message
    });
  }
  if (!categories.releaseGates.ok) {
    actions.push({
      command: 'npm run quality:gate',
      reason: categories.releaseGates.message
    });
  }
  return actions;
}

function calculateDoctorScore(categories) {
  if (Object.values(categories).every((category) => category.ok)) return 100;
  const weights = {
    releaseGates: 25,
    non3DStrength: 20,
    marketProof: 20,
    wechatPackage: 20,
    verificationEvidence: 15
  };
  return Math.round(Object.entries(weights).reduce((sum, [key, weight]) => {
    const category = categories[key] || {};
    const score = category.ok ? 100 : Number(category.score || 0);
    return sum + ((score / 100) * weight);
  }, 0));
}

function listFiles(dir) {
  const output = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...listFiles(fullPath));
    else if (entry.isFile()) output.push(fullPath);
  }
  return output;
}

function countCaseStudies(file) {
  if (!existsSync(file)) return 0;
  return (readFileSync(file, 'utf8').match(/data-case-study=/gu) || []).length;
}

function readJson(file) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      index += 1;
      options.root = argv[index];
    } else if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    } else if (arg === '--json') {
      index += 1;
      options.json = argv[index];
    }
  }
  return options;
}

function writeText(file, content) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const report = runEngineDoctorCli();
  if (!report.ready) process.exitCode = 1;
}
