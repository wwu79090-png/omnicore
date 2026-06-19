import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const RELEASE_GATE_SCRIPTS = [
  'lint',
  'test',
  'test:contract',
  'benchmark:ci',
  'performance:budget',
  'build',
  'postbuild',
  'security-check'
];
const PLATFORM_COVERAGE_SCRIPTS = [
  'test:e2e',
  'test:visual',
  'test:wechat',
  'test:minigame',
  'export:platform',
  'build:platform-assets'
];
const API_STABILITY_FILES = [
  'scripts/contract-test.js',
  'tests/contract/core-contract.test.js',
  'tests/contract/golden/omnicore-core-api.json',
  'docs/api.md',
  'docs/api/README.zh-CN.md',
  'docs/api/public-api-policy.md'
];
const MARKET_DOC_FILES = [
  'README.md',
  'docs/market-benchmark-report.md',
  'docs/platforms/wechat-minigame.md',
  'docs/getting-started-zero.zh-CN.md'
];
const NON_3D_MARKET_TARGET = 80;
const NON_3D_MARKET_DIMENSIONS = [
  {
    key: 'editorUx',
    label: '编辑器体验',
    notes: ['selection-outline', 'origin-marker', 'marquee-selection', 'copy-paste-delete', 'drag-undo'],
    checks: [
      { file: 'packages/omnicore-editor/src/editor-app.js' },
      { file: 'packages/omnicore-editor/src/live-sync-protocol.js' },
      { test: 'tests/omnicore-experience-gap.test.js' },
      { test: 'tests/omnicore-full-stack-phase5.test.js' }
    ]
  },
  {
    key: 'platformPublishing',
    label: '平台发布',
    notes: ['wechat-build', '4mb-gate', 'debug-proxy', 'minigame-tests'],
    checks: [
      { script: 'build:wechat' },
      { script: 'test:wechat' },
      { script: 'test:minigame' },
      { script: 'export:platform' },
      { file: 'scripts/build-wechat.js' },
      { file: 'docs/platforms/wechat-mini-game-publish.md' }
    ]
  },
  {
    key: 'migrationApiStability',
    label: '迁移与 API 稳定',
    notes: ['migration-cli', 'deprecated-markers', 'compatibility-aliases', 'api-audit'],
    checks: [
      { script: 'audit:api' },
      { file: 'scripts/omni-migrate.js' },
      { file: 'src/index.js' },
      { file: 'src/store/Store.js' },
      { file: 'src/core/Entity.js' },
      { test: 'tests/omnicore-experience-gap.test.js' },
      { test: 'tests/dx-experience.test.js' }
    ]
  },
  {
    key: 'onboardingDocs',
    label: '入门与示例文档',
    notes: ['10-minute-start', 'positioning', 'wechat-manual', 'template-debugging'],
    checks: [
      { file: 'README.md' },
      { file: 'website/editor/index.html' },
      { file: 'docs/getting-started.md' },
      { file: 'docs/platforms/wechat-mini-game-publish.md' },
      { file: 'examples/template-platformer/DEBUGGING.md' },
      { file: 'examples/template-rpg/DEBUGGING.md' },
      { file: 'examples/template-interactive/DEBUGGING.md' }
    ]
  },
  {
    key: 'pluginMarketplace',
    label: '插件与市场',
    notes: ['marketplace-page', 'plugin-validation', 'wechat-monetization-package', 'sdk'],
    checks: [
      { script: 'marketplace:validate' },
      { file: 'website/plugins/index.html' },
      { file: 'scripts/validate-marketplace-index.js' },
      { file: 'packages/omnicore-plugin-wechat-monetization/package.json' },
      { file: 'create-omnicore-plugin-sdk/index.mjs' }
    ]
  },
  {
    key: 'runtime2D',
    label: '2D 运行时',
    notes: ['scene-stack', 'entity-model', 'event-sheet', 'tilemap', 'physics-adapter'],
    checks: [
      { file: 'src/scene/Scene.js' },
      { file: 'src/core/Entity.js' },
      { file: 'src/data/EventSheet.js' },
      { file: 'src/tilemap/Tilemap.js' },
      { file: 'src/physics/PhysicsWorld.js' },
      { test: 'tests/performance-refactor.test.js' },
      { test: 'tests/physics-backends.test.js' }
    ]
  },
  {
    key: 'assetPipeline',
    label: '资源管线',
    notes: ['asset-import', 'pack-assets', 'platform-assets', 'asset-audit'],
    checks: [
      { script: 'audit:assets' },
      { script: 'build:platform-assets' },
      { file: 'scripts/asset-importer.js' },
      { file: 'scripts/pack-assets.js' },
      { file: 'scripts/build-platform-assets.js' }
    ]
  },
  {
    key: 'releaseQuality',
    label: '发布质量',
    notes: ['lint', 'tests', 'contract', 'benchmark', 'build-verification', 'production-ready'],
    checks: [
      { script: 'lint' },
      { script: 'test' },
      { script: 'test:contract' },
      { script: 'benchmark:ci' },
      { script: 'build' },
      { script: 'postbuild' },
      { script: 'production-ready' },
      { file: 'scripts/production-ready.js' },
      { file: 'scripts/verify-build-output.js' }
    ]
  }
];

function parseArgs(argv) {
  const options = { out: path.join(root, 'dist', 'quality-report.json') };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') {
      index += 1;
      options.out = path.resolve(argv[index]);
    }
  }
  return options;
}

export function generateQualityReport({ out = path.join(root, 'dist', 'quality-report.json') } = {}) {
  const sections = {
    sceneEditor: scoreSection([
      'packages/omnicore-editor/src/editor-app.js',
      'packages/omnicore-editor/src/live-sync-protocol.js',
      'packages/omnicore-editor/electron.main.cjs',
      'packages/omnicore-editor/bin/omnicore-editor.cjs',
      'src/editor/EditorPluginCascade.js',
      'src/editor/EditorOverlay.js'
    ], {
      label: '完整场景编辑器',
      notes: ['desktop-electron', 'dock-layout', 'hierarchy', 'inspector', 'scene-view', 'tilemap', 'prefab-drop', 'live-sync']
    }),
    animationSystem: scoreSection([
      'src/editor/AnimationEditor.js',
      'src/animations/AnimationStateMachine.js',
      'src/animation/SkeletalAnimation.js'
    ], {
      label: '动画系统',
      notes: ['timeline', 'multi-track', 'curve-editor', 'keyframes', 'state-machine', 'spine-adapter']
    }),
    assetPipeline: scoreSection([
      'scripts/pipeline.js',
      'scripts/import-assets.js',
      'scripts/asset-importer.js',
      'scripts/pack-assets.js',
      'scripts/build-platform-assets.js'
    ], {
      label: '资源管线',
      notes: ['auto-atlas', 'multi-format', 'platform-variants', 'dependency-graph']
    }),
    realDeviceBenchmark: scoreSection([
      'scripts/benchmark.js',
      'scripts/update-hardware-baseline.js',
      'docs/hardware-baseline/hardware-baseline.json',
      'docs/hardware-baseline/real-device-fps-trend.svg',
      '.github/workflows/benchmark.yml',
      'playwright.config.js',
      'tests/benchmark/complex-scene.test.js'
    ], {
      label: '真机 benchmark',
      notes: ['real-device-history', 'iphone-11', 'snapdragon-865', 'budget-android', 'complex-scene-benchmark']
    }),
    officialExamples: scoreSection([
      'examples/template-platformer/src/main.js',
      'examples/template-rpg/src/main.js',
      'examples/template-tilemap/src/main.js'
    ], {
      label: '官方示例项目',
      notes: ['platformer', 'rpg', 'tilemap']
    }),
    pluginEcosystem: scoreSection([
      'src/addons/CameraShake.js',
      'src/addons/Localization.js',
      'src/addons/ParticlePack.js',
      'src/addons/ThreeDParticles.js',
      'src/addons/AudioMixer.js',
      'src/addons/AiPathfinding.js',
      'src/addons/SaveCloud.js',
      'website/plugins/index.html',
      'create-omnicore-plugin-sdk/index.mjs'
    ], {
      label: '插件生态',
      notes: ['official-addons', 'plugin-sdk', 'marketplace-page', 'submit-plugin', 'cascade']
    })
  };

  const scores = Object.values(sections).map((section) => section.score);
  const capabilityScore = averageScore(scores);
  const marketReadiness = buildMarketReadiness();
  const non3DMarketScorecard = buildNon3DMarketScorecard();
  const overallScore = Math.round((capabilityScore * 0.55) + (marketReadiness.score * 0.45));
  const report = {
    generatedAt: new Date().toISOString(),
    package: readPackageSummary(),
    capabilityScore,
    marketReadiness,
    non3DMarketScorecard,
    overallScore,
    sections
  };

  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

export function buildMarketReadiness({
  projectRoot = root,
  packageSummary = readPackageSummary(projectRoot)
} = {}) {
  const scripts = packageSummary?.scripts || {};
  const releaseGates = scoreScriptGroup(RELEASE_GATE_SCRIPTS, scripts, '发布门禁');
  const platformCoverage = scoreScriptGroup(PLATFORM_COVERAGE_SCRIPTS, scripts, '平台覆盖');
  const apiStability = scoreApiStability(projectRoot);
  const marketDocumentation = scoreFileGroup(MARKET_DOC_FILES, projectRoot, '市场文档');
  const score = Math.round(
    (releaseGates.score * 0.35)
    + (platformCoverage.score * 0.25)
    + (apiStability.score * 0.25)
    + (marketDocumentation.score * 0.15)
  );
  return {
    score,
    releaseGates,
    platformCoverage,
    apiStability,
    marketDocumentation,
    risks: [
      ...releaseGates.missing.map((name) => `missing release gate: ${name}`),
      ...platformCoverage.missing.map((name) => `missing platform command: ${name}`),
      ...apiStability.warnings
    ]
  };
}

export function buildNon3DMarketScorecard({
  projectRoot = root,
  packageSummary = readPackageSummary(projectRoot),
  target = NON_3D_MARKET_TARGET
} = {}) {
  const scripts = packageSummary?.scripts || {};
  const dimensions = Object.fromEntries(
    NON_3D_MARKET_DIMENSIONS.map((dimension) => [
      dimension.key,
      scoreCheckDimension(dimension, projectRoot, scripts)
    ])
  );
  const dimensionScores = Object.values(dimensions).map((dimension) => dimension.score);
  const overallScore = averageScore(dimensionScores);
  return {
    target,
    excluded: ['full-3d'],
    overallScore,
    allAboveTarget: dimensionScores.every((score) => score >= target),
    dimensions,
    risks: Object.entries(dimensions)
      .filter(([, dimension]) => dimension.score < target)
      .map(([key, dimension]) => `${key} below target: ${dimension.score}`)
  };
}

function scoreSection(files, { label, notes }) {
  const checks = files.map((file) => ({
    file,
    present: existsSync(path.join(root, file))
  }));
  const present = checks.filter((check) => check.present).length;
  const score = Math.min(100, Math.round(55 + (present / checks.length) * 45));
  return {
    label,
    score,
    checks,
    notes
  };
}

function scoreScriptGroup(names, scripts, label) {
  const checks = names.map((name) => ({
    name,
    command: scripts[name] || null,
    present: Boolean(scripts[name])
  }));
  const present = checks.filter((check) => check.present).length;
  return {
    label,
    score: Math.round((present / checks.length) * 100),
    missing: checks.filter((check) => !check.present).map((check) => check.name),
    checks
  };
}

function scoreFileGroup(files, projectRoot, label) {
  const checks = files.map((file) => ({
    file,
    present: existsSync(path.join(projectRoot, file))
  }));
  const present = checks.filter((check) => check.present).length;
  return {
    label,
    score: Math.round((present / checks.length) * 100),
    missing: checks.filter((check) => !check.present).map((check) => check.file),
    checks
  };
}

function scoreCheckDimension(dimension, projectRoot, scripts) {
  const checks = dimension.checks.map((check) => {
    if (check.script) {
      return {
        script: check.script,
        command: scripts[check.script] || null,
        present: Boolean(scripts[check.script])
      };
    }
    if (check.test) {
      return {
        test: check.test,
        present: existsSync(path.join(projectRoot, check.test))
      };
    }
    return {
      file: check.file,
      present: existsSync(path.join(projectRoot, check.file))
    };
  });
  const present = checks.filter((check) => check.present).length;
  return {
    label: dimension.label,
    score: Math.round((present / checks.length) * 100),
    missing: checks.filter((check) => !check.present).map((check) => check.script || check.test || check.file),
    checks,
    notes: dimension.notes
  };
}

function scoreApiStability(projectRoot) {
  const contract = scoreFileGroup(API_STABILITY_FILES, projectRoot, 'API 稳定性');
  const publicExportCount = countPublicExports(path.join(projectRoot, 'src', 'index.js'));
  const policy = {
    file: 'docs/api/public-api-policy.md',
    present: existsSync(path.join(projectRoot, 'docs/api/public-api-policy.md'))
  };
  const contractComplete = contract.score === 100 && contract.missing.length === 0;
  const broadSurface = publicExportCount > 160;
  const managedBroadSurface = broadSurface && policy.present && contractComplete;
  const warnings = [];
  if (broadSurface && !policy.present) {
    warnings.push(`public API surface is broad: ${publicExportCount} named exports`);
  } else if (broadSurface && policy.present && !contractComplete) {
    warnings.push(`public API surface is broad and contract coverage is incomplete: ${publicExportCount} named exports`);
  }
  const exportSurfaceScore = managedBroadSurface
    ? 100
    : publicExportCount > 180
      ? (policy.present ? 85 : 65)
      : publicExportCount > 160
        ? (policy.present ? 92 : 80)
        : 100;
  return {
    label: contract.label,
    score: Math.round((contract.score * 0.7) + (exportSurfaceScore * 0.3)),
    publicExportCount,
    exportSurface: {
      score: exportSurfaceScore,
      broad: broadSurface,
      managed: managedBroadSurface,
      contractComplete
    },
    policy,
    warnings,
    checks: contract.checks,
    missing: contract.missing
  };
}

function countPublicExports(indexFile) {
  if (!existsSync(indexFile)) return 0;
  const source = readFileSync(indexFile, 'utf8');
  const matches = [...source.matchAll(/export\s*\{([\s\S]*?)\};/g)];
  const last = matches[matches.length - 1]?.[1] || '';
  return last
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .length;
}

function readPackageSummary(projectRoot = root) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    return {
      name: pkg.name,
      version: pkg.version,
      postbuild: pkg.scripts?.postbuild || null,
      scripts: pkg.scripts || {}
    };
  } catch {
    return null;
  }
}

function averageScore(values) {
  return Math.round(values.reduce((total, score) => total + score, 0) / values.length);
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const options = parseArgs(process.argv.slice(2));
  const report = generateQualityReport(options);
  console.log(JSON.stringify(report, null, 2));
}

export default generateQualityReport;
