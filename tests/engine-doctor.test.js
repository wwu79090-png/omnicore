import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const doctorUrl = pathToFileURL(path.resolve('scripts/engine-doctor.js')).href;

describe('OmniCore Engine Doctor', () => {
  it('summarizes release readiness from real artifacts and market scorecards', async () => {
    const { createEngineDoctorReport } = await import(doctorUrl);
    const root = createDoctorFixture({ includeWechatPackage: true });
    const report = createEngineDoctorReport({ projectRoot: root, generatedAt: '2026-06-19T00:00:00.000Z' });

    expect(report.ready).toBe(true);
    expect(report.score).toBe(100);
    expect(report.categories.wechatPackage).toMatchObject({ ok: true, bytes: expect.any(Number), fileCount: 3 });
    expect(report.categories.marketProof.ok).toBe(true);
    expect(report.categories.adoptionReadiness.ok).toBe(true);
    expect(report.categories.marketPositioning.ok).toBe(true);
    expect(report.marketPositioningScorecard).toMatchObject({
      target: 90,
      allAboveTarget: true
    });
    expect(report.categories.improvementBacklog).toMatchObject({
      ok: true,
      opportunities: expect.any(Number),
      p0Count: expect.any(Number)
    });
    expect(report.improvementBacklog.summary.totalOpportunities).toBeGreaterThanOrEqual(30);
    expect(report.nextActions).toEqual([]);
  });

  it('blocks readiness when the WeChat package is missing or empty', async () => {
    const { createEngineDoctorReport } = await import(doctorUrl);
    const root = createDoctorFixture({ includeWechatPackage: false });
    const report = createEngineDoctorReport({ projectRoot: root });

    expect(report.ready).toBe(false);
    expect(report.categories.wechatPackage).toMatchObject({ ok: false, severity: 'error' });
    expect(report.nextActions).toContainEqual(expect.objectContaining({
      command: 'npm run build:wechat && npm run performance:budget'
    }));
  });

  it('writes markdown and json from the doctor CLI', () => {
    const root = createDoctorFixture({ includeWechatPackage: true });
    execFileSync(process.execPath, [
      'scripts/engine-doctor.js',
      '--root', root,
      '--out', path.join(root, 'doctor.md'),
      '--json', path.join(root, 'doctor.json')
    ], { cwd: process.cwd(), encoding: 'utf8' });

    expect(readFileSync(path.join(root, 'doctor.md'), 'utf8')).toContain('# OmniCore Engine Doctor');
    expect(JSON.parse(readFileSync(path.join(root, 'doctor.json'), 'utf8')).ready).toBe(true);
  });

  it('routes omni doctor to the same report generator', () => {
    const root = createDoctorFixture({ includeWechatPackage: true });
    execFileSync(process.execPath, [
      'scripts/omni.js',
      'doctor',
      '--root', root,
      '--json', path.join(root, 'omni-doctor.json')
    ], { cwd: process.cwd(), encoding: 'utf8' });

    expect(JSON.parse(readFileSync(path.join(root, 'omni-doctor.json'), 'utf8')).ready).toBe(true);
  });

  it('registers doctor in scripts and quality report production trust checks', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const qualityScript = readFileSync('scripts/generate-quality-report.js', 'utf8');

    expect(packageJson.scripts.doctor).toBe('node scripts/engine-doctor.js');
    expect(qualityScript).toContain("{ script: 'doctor' }");
    expect(qualityScript).toContain("{ file: 'scripts/engine-doctor.js' }");
  });
});

function createDoctorFixture({ includeWechatPackage }) {
  const root = path.join(tmpdir(), `omnicore-doctor-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  writeJson(path.join(root, 'package.json'), {
    scripts: {
      lint: 'eslint .',
      test: 'vitest run',
      'test:contract': 'node scripts/contract-test.js',
      'benchmark:ci': 'node scripts/benchmark-threshold.js',
      'performance:budget': 'node scripts/performance-budget.js',
      build: 'vite build',
      postbuild: 'node scripts/verify-build-output.js',
      'security-check': 'node scripts/security-check.js',
      'build:wechat': 'node scripts/build-wechat.js',
      'test:wechat': 'node scripts/test-wechat.js',
      'test:minigame': 'node scripts/test-minigame.js',
      'test:e2e': 'playwright test tests/e2e',
      'test:visual': 'node scripts/visual-regression.js --threshold 0.005',
      'export:platform': 'node scripts/export-platform.js',
      'build:platform-assets': 'node scripts/build-platform-assets.js',
      'marketplace:generate': 'node scripts/generate-marketplace-site.js',
      'marketplace:validate': 'node scripts/validate-marketplace-index.js',
      'audit:api': 'node scripts/audit-api-style.js',
      'audit:assets': 'node scripts/audit-assets.js',
      'quality:engine': 'node scripts/engine-quality-gate.js',
      'quality:gate': 'node scripts/production-ready.js --verify',
      'production-ready': 'node scripts/production-ready.js',
      editor: 'node packages/omnicore-editor/bin/omnicore-editor.cjs',
      doctor: 'node scripts/engine-doctor.js'
    }
  });
  const files = [
    'README.md',
    'docs/market-benchmark-report.md',
    'docs/platforms/wechat-minigame.md',
    'docs/platforms/wechat-mini-game-publish.md',
    'docs/getting-started-zero.zh-CN.md',
    'docs/getting-started.md',
    'docs/migration/from-phaser.md',
    'docs/migration/from-construct.md',
    'docs/migration/from-cocos.md',
    'docs/adoption/30-minute-trial.md',
    'docs/market-positioning/web-2d-engine-candidate.md',
    'docs/api.md',
    'docs/api/README.zh-CN.md',
    'docs/api/public-api-policy.md',
    'scripts/contract-test.js',
    'scripts/omni-migrate.js',
    'scripts/validate-marketplace-index.js',
    'scripts/asset-importer.js',
    'scripts/pack-assets.js',
    'scripts/build-platform-assets.js',
    'scripts/verify-build-output.js',
    'tests/contract/core-contract.test.js',
    'tests/contract/golden/omnicore-core-api.json',
    'website/assets/code-awakener-screenshot.svg',
    'website/assets/code-awakener-progress.svg',
    'packages/omnicore-editor/src/live-sync-protocol.js',
    'packages/omnicore-editor/electron.main.cjs',
    'packages/omnicore-editor/preload.cjs',
    'packages/omnicore-editor/src/editor-app.js',
    'packages/omnicore-editor/workspace.cjs',
    'tests/desktop-editor-workflow.test.js',
    'tests/lowcode-editor-suite.test.js',
    'tests/editor-industrial-authoring.test.js',
    'src/package/PluginInstaller.js',
    'website/marketplace/index.html',
    'website/marketplace/omni-particles/index.html',
    'website/migration/index.html',
    'website/tutorials/index.html',
    '.github/workflows/marketplace-review.yml',
    'tests/plugin-installer-platform.test.js',
    'tests/marketplace-platform.test.js',
    'tests/market-adoption-readiness.test.js',
    'scripts/build-wechat.js',
    'scripts/performance-budget.js',
    'packages/omnicore-editor/scripts/package-desktop.cjs',
    'scripts/production-ready.js',
    'scripts/engine-quality-gate.js',
    'scripts/engine-doctor.js',
    'scripts/engine-improvements.js',
    'src/quality/EngineQualityHarness.js',
    'src/quality/ImprovementPlanner.js',
    'src/quality/MarketPositioningScorecard.js',
    'src/compat/phaser/PhaserCompat.js',
    'src/renderer/PixiFrameworkBridge.js',
    'src/renderer/PixiRenderer.js',
    'src/renderer/PixiTextureLifecycle.js',
    'src/renderer/Filters.js',
    'src/renderer/RenderLayerManager.js',
    'src/debug/FrameProfiler.js',
    'src/editor/EditorMarketReadiness.js',
    'docs/security/security.md',
    'website/editor/index.html',
    'website/plugins/index.html',
    'website/market-positioning/index.html',
    'create-omnicore-plugin-sdk/index.mjs',
    'packages/omnicore-plugin-wechat-monetization/package.json',
    'src/index.js',
    'src/store/Store.js',
    'src/core/Entity.js',
    'src/scene/Scene.js',
    'src/data/EventSheet.js',
    'src/tilemap/Tilemap.js',
    'src/physics/PhysicsWorld.js',
    'tests/omnicore-experience-gap.test.js',
    'tests/omnicore-full-stack-phase5.test.js',
    'tests/dx-experience.test.js',
    'tests/performance-refactor.test.js',
    'tests/physics-backends.test.js',
    'tests/editor-market-readiness.test.js',
    'tests/editor-maturity-ui.test.js',
    'tests/market-90-scorecard.test.js',
    'tests/phaser-compat-layer.test.js',
    'tests/pixi-framework-layer.test.js',
    'tests/web2d-market-position.test.js',
    'tests/benchmark-threshold.test.js',
    'tests/migration-analysis.test.js',
    'examples/template-platformer/DEBUGGING.md',
    'examples/template-platformer/README.md',
    'examples/template-rpg/DEBUGGING.md',
    'examples/template-interactive/DEBUGGING.md',
    'tests/market-competitiveness-score.test.js'
  ];
  files.forEach((file) => writeText(path.join(root, file), 'ok\n'));
  writeText(path.join(root, 'website/case-studies.html'), [
    '<article data-case-study="one"></article>',
    '<article data-case-study="two"></article>',
    '<article data-case-study="three"></article>'
  ].join('\n'));
  writeText(path.join(root, 'website/case-studies.md'), [
    '## One',
    '发布证据 质量门禁',
    '## Two',
    '发布证据 质量门禁',
    '## Three',
    '发布证据 质量门禁'
  ].join('\n'));
  writeJson(path.join(root, 'docs/release-notes/production-ready-report.json'), { ready: true, score: 100 });
  writeJson(path.join(root, 'docs/security/security-check-latest.json'), { ok: true });
  writeJson(path.join(root, 'docs/release-notes/benchmark-current.json'), { ok: true });

  if (includeWechatPackage) {
    writeText(path.join(root, 'dist/wechat/game.js'), 'console.log("ok");\n');
    writeText(path.join(root, 'dist/wechat/index.html'), '<div id="app"></div>\n');
    writeJson(path.join(root, 'dist/wechat/wechat-build-report.json'), {
      pass: true,
      bytes: 1024,
      limitBytes: 4194304
    });
  }

  return root;
}

function writeText(file, content) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

function writeJson(file, payload) {
  writeText(file, `${JSON.stringify(payload, null, 2)}\n`);
}
