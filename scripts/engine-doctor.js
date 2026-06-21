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
  buildMarketAdoptionReadiness,
  buildMarketCompetitivenessScorecard,
  buildMarketReadiness,
  buildNon3DMarketScorecard
} from './generate-quality-report.js';
import { buildEngineImprovementPlan } from '../src/quality/ImprovementPlanner.js';
import { buildMarketPositioningScorecard } from '../src/quality/MarketPositioningScorecard.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FOUR_MB = 4 * 1024 * 1024;

export function createEngineDoctorReport({
  projectRoot = root,
  generatedAt = new Date().toISOString()
} = {}) {
  const normalizedRoot = path.resolve(projectRoot);
  const packageSummary = readPackageSummary(normalizedRoot);
  const health = createHealthReport(normalizedRoot, packageSummary);
  const marketReadiness = buildMarketReadiness({ projectRoot: normalizedRoot, packageSummary });
  const non3DMarketScorecard = buildNon3DMarketScorecard({ projectRoot: normalizedRoot, packageSummary });
  const marketCompetitiveness = buildMarketCompetitivenessScorecard({ projectRoot: normalizedRoot, packageSummary });
  const marketAdoptionReadiness = buildMarketAdoptionReadiness({ projectRoot: normalizedRoot, packageSummary });
  const marketPositioningScorecard = buildMarketPositioningScorecard({ projectRoot: normalizedRoot, packageSummary });
  const engineImprovementPlan = buildEngineImprovementPlan({
    projectRoot: normalizedRoot,
    generatedAt
  });
  const categories = {
    releaseGates: evaluateReleaseGates(marketReadiness),
    non3DStrength: evaluateScorecard(non3DMarketScorecard, 'non-3D market scorecard'),
    marketProof: evaluateScorecard(marketCompetitiveness, 'market competitiveness'),
    adoptionReadiness: evaluateScorecard(marketAdoptionReadiness, 'market adoption readiness'),
    marketPositioning: evaluateScorecard(marketPositioningScorecard, 'market positioning scorecard'),
    improvementBacklog: evaluateImprovementBacklog(engineImprovementPlan),
    wechatPackage: evaluateWechatPackage(normalizedRoot),
    verificationEvidence: evaluateVerificationEvidence(normalizedRoot)
  };
  const nextActions = buildNextActions(categories);
  const score = nextActions.length === 0 ? 100 : calculateDoctorScore(categories);
  const diagnostics = createDoctorDiagnostics({
    projectRoot: normalizedRoot,
    categories,
    packageSummary
  });
  return {
    generatedAt,
    ready: nextActions.length === 0,
    score,
    health,
    categories,
    diagnostics,
    improvementBacklog: {
      summary: engineImprovementPlan.summary,
      completedOpportunities: engineImprovementPlan.completedOpportunities,
      pendingOpportunities: engineImprovementPlan.pendingOpportunities,
      nextActions: engineImprovementPlan.nextActions
    },
    marketPositioningScorecard,
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
  if (report.health) {
    lines.push('', '## Health Report', '', '| Area | Status | Detail |', '| --- | --- | --- |');
    for (const [name, item] of Object.entries(report.health)) {
      lines.push(`| ${name} | ${item.ok ? 'ok' : item.severity || 'warning'} | ${item.message || ''} |`);
    }
  }
  if (report.nextActions.length) {
    lines.push('', '## Next Actions');
    for (const action of report.nextActions) lines.push(`- ${action.command}: ${action.reason}`);
  }
  if (report.diagnostics?.zh?.length) {
    lines.push('', '## 中文诊断建议', '', '| Code | 现象 | 处理动作 |', '| --- | --- | --- |');
    for (const item of report.diagnostics.zh) {
      lines.push(`| ${item.code} | ${escapeMarkdownTable(item.symptom)} | ${escapeMarkdownTable(item.action)} |`);
    }
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
      scripts: json.scripts || {},
      dependencies: json.dependencies || {},
      devDependencies: json.devDependencies || {},
      packageManager: json.packageManager || null
    };
  } catch {
    return { scripts: {} };
  }
}

function createHealthReport(projectRoot, packageSummary) {
  return {
    dependencies: evaluateDependencyHealth(packageSummary),
    environment: evaluateEnvironmentHealth(),
    resources: evaluateResourceHealth(projectRoot)
  };
}

function evaluateDependencyHealth(packageSummary = {}) {
  const dependencies = packageSummary.dependencies || {};
  const devDependencies = packageSummary.devDependencies || {};
  const dependencyCount = Object.keys(dependencies).length;
  const devDependencyCount = Object.keys(devDependencies).length;
  const ok = dependencyCount + devDependencyCount > 0;
  return {
    ok,
    severity: ok ? 'info' : 'warning',
    dependencyCount,
    devDependencyCount,
    packageManager: packageSummary.packageManager || 'npm',
    message: ok
      ? `${dependencyCount} runtime dependencies and ${devDependencyCount} dev dependencies declared`
      : 'package.json has no dependencies or devDependencies'
  };
}

function evaluateEnvironmentHealth() {
  const { node } = process.versions;
  const major = Number(node.split('.')[0]);
  const ok = Number.isFinite(major) && major >= 18;
  return {
    ok,
    severity: ok ? 'info' : 'warning',
    node,
    platform: process.platform,
    arch: process.arch,
    message: ok
      ? `Node ${node} on ${process.platform}/${process.arch}`
      : `Node ${node} is below the recommended 18.x runtime`
  };
}

function evaluateResourceHealth(projectRoot) {
  const assetRoot = path.join(projectRoot, 'assets');
  const manifestCandidates = [
    path.join(projectRoot, 'asset-manifest.json'),
    path.join(projectRoot, 'assets', 'sprites', 'default', 'default-atlas.json')
  ];
  const assetFiles = existsSync(assetRoot) ? listFiles(assetRoot).length : 0;
  const hasManifest = manifestCandidates.some((file) => existsSync(file));
  const missing = [];
  if (assetFiles === 0) missing.push('assets');
  if (!hasManifest) missing.push('asset-manifest');
  return {
    ok: missing.length === 0 || assetFiles > 0,
    severity: missing.length === 0 ? 'info' : 'warning',
    assetFiles,
    hasManifest,
    missing: assetFiles > 0 ? missing.filter((item) => item !== 'assets') : missing,
    message: assetFiles > 0
      ? `${assetFiles} asset files found${hasManifest ? ' with manifest evidence' : ''}`
      : 'no asset files found'
  };
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

function evaluateImprovementBacklog(plan) {
  const total = Number(plan?.summary?.totalOpportunities || 0);
  const p0Count = Number(plan?.summary?.p0Count || 0);
  const evidenceCompleteCount = Number(plan?.summary?.evidenceCompleteCount || 0);
  const evidencePendingCount = Number(plan?.summary?.evidencePendingCount || 0);
  const evidenceCompletionScore = Number(plan?.summary?.evidenceCompletionScore || 0);
  const ok = total >= 30 && p0Count >= 5;
  return {
    ok,
    severity: ok ? 'info' : 'warning',
    score: ok ? 100 : Math.min(90, Math.round((total / 30) * 100)),
    opportunities: total,
    p0Count,
    evidenceCompleteCount,
    evidencePendingCount,
    evidenceCompletionScore,
    message: ok
      ? `engine improvement backlog is actionable with ${total} opportunities; ${evidenceCompleteCount} complete and ${evidencePendingCount} pending`
      : 'engine improvement backlog is too small or lacks P0 actions'
  };
}

function evaluateWechatPackage(projectRoot) {
  const dir = path.join(projectRoot, 'dist', 'wechat');
  if (!existsSync(dir)) {
    return evaluateArchivedWechatPackage(projectRoot);
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

function evaluateArchivedWechatPackage(projectRoot) {
  const report = readJson(path.join(projectRoot, 'docs', 'release-notes', 'wechat-package-latest.json'));
  const bytes = Number(report?.bytes || 0);
  const fileCount = Number(report?.fileCount || 0);
  const limitBytes = Number(report?.limitBytes || FOUR_MB);
  const ok = report?.pass === true && bytes > 0 && fileCount > 0 && bytes <= limitBytes;
  return {
    ok,
    archived: Boolean(report),
    severity: ok ? 'info' : 'error',
    score: ok ? 100 : 0,
    bytes,
    fileCount,
    limitBytes,
    message: ok
      ? 'WeChat package archive report is present and under 4MB'
      : 'dist/wechat is missing and no passing archive report is available'
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
  if (!categories.adoptionReadiness.ok) {
    actions.push({
      command: 'node scripts/generate-quality-report.js --out quality-report.json',
      reason: categories.adoptionReadiness.message
    });
  }
  if (!categories.marketPositioning.ok) {
    actions.push({
      command: 'node scripts/generate-quality-report.js --out quality-report.json',
      reason: categories.marketPositioning.message
    });
  }
  if (!categories.improvementBacklog.ok) {
    actions.push({
      command: 'npm run improvements -- --out dist/engine-improvements.json --markdown docs/release-notes/engine-improvements.md',
      reason: categories.improvementBacklog.message
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

function createDoctorDiagnostics({ projectRoot, categories, packageSummary }) {
  const hasAssets = categories?.verificationEvidence?.ok || existsSync(path.join(projectRoot, 'assets'));
  const scripts = packageSummary.scripts || {};
  return {
    zh: [
      {
        code: 'resource-404',
        severity: hasAssets ? 'info' : 'warning',
        symptom: '资源 404、首屏空白或贴图丢失。',
        cause: '资源 manifest、构建输出路径或 file:// 本地打开路径不一致。',
        action: '先运行 npm run import 或 npm run build，再检查 assets.manifest.json 和浏览器 Network 面板。'
      },
      {
        code: 'font-load-failed',
        severity: 'warning',
        symptom: '中文字体回退、方块字、文字首帧闪烁。',
        cause: '中文字体未在游戏渲染前预加载，或离线包缺少字体文件。',
        action: '使用 OmniCore.Font.load(fontName, url) 预加载，并把字体加入资源 manifest。'
      },
      {
        code: 'webgl-webgpu-unsupported',
        severity: 'warning',
        symptom: 'WebGL/WebGPU 初始化失败、Canvas 黑屏或渲染后端降级。',
        cause: '浏览器、显卡驱动、WebView 或微信运行时不支持目标后端。',
        action: '记录 navigator.gpu/WebGL 探测结果，确认 Pixi/WebGL/Canvas fallback 是否能正常渲染。'
      },
      {
        code: 'npm-publish-pending',
        severity: scripts['publish:dry-run'] ? 'info' : 'warning',
        symptom: '用户执行 npm install omnicore 返回 404 或版本不是最新。',
        cause: 'npm registry 还没有公开发布当前包。',
        action: '先运行 npm run publish:dry-run，确认包内容后使用 NPM token 执行 npm publish。'
      },
      {
        code: 'vercel-wrong-site',
        severity: 'warning',
        symptom: '官网链接打开后不是 OmniCore 引擎主页。',
        cause: 'Vercel 项目绑定、生产域名或部署目录指向错误。',
        action: '检查 vercel.json、项目绑定和生产域名，部署后抓取 title 验证。'
      },
      {
        code: 'wechat-package-state',
        severity: categories?.wechatPackage?.ok ? 'info' : 'error',
        symptom: '微信开发者工具上传失败、包体超过 4MB 或资源缺失。',
        cause: 'build:wechat 输出缺少通过报告，或主包没有按红线拆分资源。',
        action: '运行 npm run build:wechat，查看最大文件和目录明细，超过 4MB 立即拆分资源。'
      }
    ]
  };
}

function calculateDoctorScore(categories) {
  if (Object.values(categories).every((category) => category.ok)) return 100;
  const weights = {
    releaseGates: 22,
    non3DStrength: 15,
    marketProof: 15,
    adoptionReadiness: 10,
    marketPositioning: 8,
    improvementBacklog: 8,
    wechatPackage: 14,
    verificationEvidence: 8
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

function escapeMarkdownTable(value = '') {
  return String(value).replace(/\|/gu, '\\|').replace(/\n/gu, '<br>');
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const report = runEngineDoctorCli();
  if (!report.ready) process.exitCode = 1;
}
