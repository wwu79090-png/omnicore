import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createProductionReadyReport } from '../scripts/production-ready.js';

describe('quality report generation', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('generates build quality-report.json covering weak engine dimensions', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-quality-report-'));

    execFileSync(process.execPath, [
      'scripts/generate-quality-report.js',
      '--out',
      path.join(temp, 'quality-report.json')
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const reportPath = path.join(temp, 'quality-report.json');
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const verifier = readFileSync('scripts/verify-build-output.js', 'utf8');

    expect(existsSync(reportPath)).toBe(true);
    expect(packageJson.scripts.postbuild).toBe('node scripts/verify-build-output.js');
    expect(verifier).toContain('generateQualityReport');
    expect(report.sections).toMatchObject({
      sceneEditor: expect.objectContaining({ score: expect.any(Number) }),
      animationSystem: expect.objectContaining({ score: expect.any(Number) }),
      assetPipeline: expect.objectContaining({ score: expect.any(Number) }),
      realDeviceBenchmark: expect.objectContaining({ score: expect.any(Number) }),
      officialExamples: expect.objectContaining({ score: expect.any(Number) }),
      pluginEcosystem: expect.objectContaining({ score: expect.any(Number) })
    });
    expect(report.capabilityScore).toBeGreaterThanOrEqual(78);
    expect(report.marketReadiness).toMatchObject({
      score: expect.any(Number),
      releaseGates: expect.objectContaining({
        label: '发布门禁',
        score: 100,
        checks: expect.arrayContaining([
          expect.objectContaining({ name: 'lint', present: true }),
          expect.objectContaining({ name: 'test', present: true }),
          expect.objectContaining({ name: 'performance:budget', present: true }),
          expect.objectContaining({ name: 'quality:engine', present: true }),
          expect.objectContaining({ name: 'build', present: true }),
          expect.objectContaining({ name: 'postbuild', present: true })
        ])
      }),
      apiStability: expect.objectContaining({
        score: 100,
        publicExportCount: expect.any(Number),
        exportSurface: expect.objectContaining({
          managed: true,
          score: 100
        }),
        warnings: expect.any(Array),
        policy: expect.objectContaining({
          file: 'docs/api/public-api-policy.md',
          present: true
        })
      }),
      platformCoverage: expect.objectContaining({
        checks: expect.arrayContaining([
          expect.objectContaining({ name: 'test:e2e', present: true }),
          expect.objectContaining({ name: 'test:wechat', present: true }),
          expect.objectContaining({ name: 'test:minigame', present: true })
        ])
      }),
      marketDocumentation: expect.objectContaining({
        score: 100,
        missing: []
      })
    });
    expect(report.non3DMarketScorecard).toMatchObject({
      target: 80,
      allAboveTarget: true,
      excluded: expect.arrayContaining(['full-3d'])
    });
    expect(report.non3DMarketScorecard.overallScore).toBeGreaterThanOrEqual(80);
    expect(report.non3DMarketScorecard.dimensions.editorUx).toMatchObject({
      score: expect.any(Number),
      checks: expect.arrayContaining([
        expect.objectContaining({ file: 'packages/omnicore-editor/src/editor-app.js', present: true }),
        expect.objectContaining({ test: 'tests/omnicore-experience-gap.test.js', present: true })
      ])
    });
    for (const dimension of Object.values(report.non3DMarketScorecard.dimensions)) {
      expect(dimension.score).toBeGreaterThanOrEqual(80);
    }
    expect(report.overallScore).toBeGreaterThanOrEqual(78);
  });

  it('writes a production-ready report to a caller-selected path with readiness gates', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-production-ready-'));
    const outFile = path.join(temp, 'production-ready-report.json');

    execFileSync(process.execPath, [
      'scripts/production-ready.js',
      '--out',
      outFile
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const report = JSON.parse(readFileSync(outFile, 'utf8'));
    expect(report).toMatchObject({
      version: expect.any(String),
      ready: true,
      score: 100,
      marketReadiness: expect.objectContaining({
        score: 100,
        releaseGates: expect.objectContaining({ score: 100 }),
        apiStability: expect.objectContaining({ score: 100 }),
        platformCoverage: expect.objectContaining({ score: expect.any(Number) })
      })
    });
    expect(report.findings.some((item) => item.level === 'error')).toBe(false);
    expect(report.findings.some((item) => item.message === 'console.log remains in source')).toBe(false);
    expect(report.findings.some((item) => item.message.includes('public API surface is broad'))).toBe(false);
    expect(report.verification).toMatchObject({
      enabled: false,
      ok: true,
      results: []
    });
  });

  it('records executable verification evidence and blocks readiness on command failures', () => {
    const report = createProductionReadyReport({
      verify: true,
      verificationTimeoutMs: 10_000,
      verificationCommands: [
        {
          name: 'verification-pass',
          command: process.execPath,
          args: ['-e', 'process.stdout.write("pass")']
        },
        {
          name: 'verification-fail',
          command: process.execPath,
          args: ['-e', 'process.stderr.write("fail"); process.exit(3)']
        }
      ]
    });

    const pass = report.verification.results.find((item) => item.name === 'verification-pass');
    const fail = report.verification.results.find((item) => item.name === 'verification-fail');

    expect(report.ready).toBe(false);
    expect(report.verification).toMatchObject({
      enabled: true,
      ok: false,
      failed: ['verification-fail']
    });
    expect(pass).toMatchObject({
      ok: true,
      status: 0,
      stdout: 'pass',
      stderr: ''
    });
    expect(fail).toMatchObject({
      ok: false,
      status: 3,
      stdout: '',
      stderr: 'fail'
    });
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: 'error',
        file: 'verification',
        message: 'verification command failed: verification-fail'
      })
    ]));
  });
});
