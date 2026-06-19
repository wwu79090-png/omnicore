const DEFAULT_TARGET = 90;

const MARKET_POSITIONING_DIMENSIONS = [
  {
    key: 'web2DEngineCandidate',
    label: 'Web 2D 引擎候选',
    checks: [
      { file: 'src/scene/Scene.js' },
      { file: 'src/renderer/WebGPURenderer.js' },
      { file: 'src/renderer/PixiRenderer.js' },
      { file: 'src/quality/EngineQualityHarness.js' },
      { file: 'docs/market-positioning/web-2d-engine-candidate.md' },
      { file: 'website/market-positioning/index.html' },
      { test: 'tests/web2d-market-position.test.js' },
      { script: 'benchmark:ci' },
      { script: 'quality:gate' },
      { script: 'build:wechat' }
    ]
  },
  {
    key: 'phaserMigrationAppeal',
    label: 'Phaser 迁移吸引力',
    checks: [
      { file: 'src/compat/phaser/PhaserCompat.js' },
      { file: 'scripts/omni-migrate.js' },
      { file: 'docs/migration/from-phaser.md' },
      { file: 'docs/adoption/30-minute-trial.md' },
      { file: 'website/migration/index.html' },
      { test: 'tests/phaser-compat-layer.test.js' },
      { test: 'tests/migration-analysis.test.js' },
      { script: 'test:contract' },
      { script: 'build' },
      { script: 'doctor' }
    ]
  },
  {
    key: 'pixiFrameworkLayer',
    label: 'Pixi 上层游戏框架竞争力',
    checks: [
      { file: 'src/renderer/PixiFrameworkBridge.js' },
      { file: 'src/renderer/PixiRenderer.js' },
      { file: 'src/renderer/PixiTextureLifecycle.js' },
      { file: 'src/renderer/Filters.js' },
      { file: 'src/renderer/RenderLayerManager.js' },
      { file: 'src/debug/FrameProfiler.js' },
      { test: 'tests/pixi-framework-layer.test.js' },
      { test: 'tests/benchmark-threshold.test.js' },
      { script: 'benchmark:ci' },
      { script: 'quality:engine' }
    ]
  },
  {
    key: 'editorLowCodeMaturity',
    label: '编辑器与低代码成熟度',
    checks: [
      { file: 'src/editor/EditorMarketReadiness.js' },
      { file: 'packages/omnicore-editor/src/editor-app.js' },
      { file: 'packages/omnicore-editor/src/live-sync-protocol.js' },
      { file: 'packages/omnicore-editor/electron.main.cjs' },
      { test: 'tests/editor-market-readiness.test.js' },
      { test: 'tests/lowcode-editor-suite.test.js' },
      { test: 'tests/editor-maturity-ui.test.js' },
      { test: 'tests/desktop-editor-workflow.test.js' },
      { script: 'editor' },
      { script: 'test:e2e' }
    ]
  }
];

export function buildMarketPositioningScorecard({
  projectRoot = getDefaultProjectRoot(),
  packageSummary = readPackageSummary(projectRoot),
  target = DEFAULT_TARGET
} = {}) {
  const scripts = packageSummary?.scripts || {};
  const dimensions = Object.fromEntries(
    MARKET_POSITIONING_DIMENSIONS.map((dimension) => [
      dimension.key,
      scoreDimension(dimension, projectRoot, scripts)
    ])
  );
  const scores = Object.values(dimensions).map((dimension) => dimension.score);
  const overallScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  return {
    target,
    overallScore,
    allAboveTarget: scores.every((score) => score >= target),
    dimensions,
    risks: Object.entries(dimensions)
      .filter(([, dimension]) => dimension.score < target)
      .map(([key, dimension]) => `${key} below ${target}: ${dimension.score}`)
  };
}

function scoreDimension(dimension, projectRoot, scripts) {
  const checks = dimension.checks.map((check) => {
    if (check.script) {
      return {
        script: check.script,
        present: Boolean(scripts[check.script]),
        command: scripts[check.script] || null
      };
    }
    const field = check.test ? 'test' : 'file';
    const value = check[field];
    return {
      [field]: value,
      present: fileExists(joinPath(projectRoot, value))
    };
  });
  const present = checks.filter((check) => check.present).length;
  return {
    label: dimension.label,
    score: Math.round((present / checks.length) * 100),
    missing: checks.filter((check) => !check.present).map((check) => check.script || check.test || check.file),
    checks
  };
}

function readPackageSummary(projectRoot) {
  const fs = getNodeFs();
  if (!fs) return { scripts: {} };
  try {
    const pkg = JSON.parse(fs.readFileSync(joinPath(projectRoot, 'package.json'), 'utf8'));
    return { scripts: pkg.scripts || {} };
  } catch {
    return { scripts: {} };
  }
}

function fileExists(file) {
  const fs = getNodeFs();
  return fs ? fs.existsSync(file) : false;
}

function joinPath(...parts) {
  const pathModule = getNodePath();
  if (pathModule) return pathModule.join(...parts);
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/gu, '/');
}

function getDefaultProjectRoot() {
  return globalThis.process?.cwd?.() || '/';
}

function getNodeFs() {
  return globalThis.process?.getBuiltinModule?.('fs') || null;
}

function getNodePath() {
  return globalThis.process?.getBuiltinModule?.('path') || null;
}

export default buildMarketPositioningScorecard;
