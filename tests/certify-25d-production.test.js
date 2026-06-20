import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  create25DProductionCertification,
  write25DProductionCertification
} from '../scripts/certify-25d-production.js';

describe('2.5D production certification gate', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('creates JSON and Markdown evidence for the editor deploy loop', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-25d-certification-'));
    const outJson = path.join(temp, '25d-production-certification.json');
    const outMarkdown = path.join(temp, '25d-production-certification.md');

    const { report } = write25DProductionCertification({
      outJson,
      outMarkdown,
      generatedAt: '2026-06-20T00:00:00.000Z'
    });

    expect(existsSync(outJson)).toBe(true);
    expect(existsSync(outMarkdown)).toBe(true);
    expect(JSON.parse(readFileSync(outJson, 'utf8'))).toEqual(report);
    expect(report).toMatchObject({
      format: 'OmniCore.25DProductionCertification',
      version: 1,
      generatedAt: '2026-06-20T00:00:00.000Z',
      ready: true,
      releaseGate: {
        name: 'certify:25d',
        command: 'npm run certify:25d'
      },
      evidence: expect.objectContaining({
        budget: expect.objectContaining({
          profile: '2.5d-editor-lite',
          maxFiles: 12,
          fileCount: expect.any(Number),
          overBudget: false
        })
      })
    });
    expect(report.score).toBeGreaterThanOrEqual(95);
    expect(report.workflow).toEqual(['plan', 'apply', 'save', 'export', 'readiness']);
    expect(report.evidence.stages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'plan', status: 'pass' }),
      expect.objectContaining({ id: 'apply', status: 'pass' }),
      expect.objectContaining({ id: 'save', status: 'pass' }),
      expect.objectContaining({ id: 'export', status: 'pass' }),
      expect.objectContaining({ id: 'readiness', status: 'pass' })
    ]));

    const markdown = readFileSync(outMarkdown, 'utf8');
    expect(markdown).toContain('2.5D Production Certification');
    expect(markdown).toContain('Score: 100');
    expect(markdown).toContain('Workflow: plan -> apply -> save -> export -> readiness');
    expect(markdown).toContain('Profile: 2.5d-editor-lite');
  });

  it('exposes an npm script and runnable CLI gate', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-25d-certification-cli-'));
    const outJson = path.join(temp, 'cli-certification.json');
    const outMarkdown = path.join(temp, 'cli-certification.md');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.scripts['certify:25d']).toBe('node scripts/certify-25d-production.js');

    const stdout = execFileSync(process.execPath, [
      'scripts/certify-25d-production.js',
      '--out-json',
      outJson,
      '--out-markdown',
      outMarkdown,
      '--generated-at',
      '2026-06-20T00:00:00.000Z'
    ], { cwd: process.cwd(), encoding: 'utf8' });
    const report = JSON.parse(readFileSync(outJson, 'utf8'));

    expect(stdout).toContain('25D production certification passed');
    expect(existsSync(outMarkdown)).toBe(true);
    expect(report.ready).toBe(true);
    expect(report.score).toBe(100);
  });

  it('marks the gate as failed when the benchmark evidence is over budget', () => {
    const report = create25DProductionCertification({
      maxFiles: 2,
      generatedAt: '2026-06-20T00:00:00.000Z'
    });

    expect(report.ready).toBe(false);
    expect(report.evidence.budget).toMatchObject({
      fileCount: 3,
      maxFiles: 2,
      overBudget: true
    });
    expect(report.nextActions).toEqual(expect.arrayContaining([
      expect.stringContaining('lightweight deploy bundle exceeds')
    ]));
  });

  it('certifies a real editor production bundle instead of the canned demo', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-25d-certification-bundle-'));
    const bundlePath = path.join(temp, 'production-bundle.json');
    writeFileSync(bundlePath, JSON.stringify({
      format: 'OmniCore.ProductionDeploymentBundle',
      version: 1,
      generatedAt: '2026-06-20T00:00:00.000Z',
      productionReady: true,
      readiness: {
        ready: true,
        score: 100
      },
      deployment: {
        manifest: {
          profile: '2.5d-editor-lite',
          targets: ['web'],
          entryScene: 'scenes/forest-demo.scene.json',
          scenes: 1,
          assets: 2,
          coCreationPlans: 1
        },
        files: [
          {
            path: 'scenes/forest-demo.scene.json',
            data: {
              name: 'forest-demo',
              entities: [
                { id: 'forest', type: 'forest' },
                {
                  id: 'forest-tower',
                  type: 'dimension3d-model',
                  coCreated: true,
                  coCreationPlan: {
                    protocol: 'omnicore-editor-25d-cocreation/v1',
                    prompt: '在树林后建一个高塔，塔顶有一把剑'
                  }
                }
              ]
            }
          },
          { path: 'manifests/deploy-lite.json', data: { profile: '2.5d-editor-lite' } },
          {
            path: 'plans/25d-cocreation/forest-tower.json',
            data: {
              prompt: '在树林后建一个高塔，塔顶有一把剑'
            }
          }
        ]
      }
    }, null, 2));

    const report = create25DProductionCertification({
      bundlePath,
      generatedAt: '2026-06-20T00:00:00.000Z'
    });

    expect(report).toMatchObject({
      ready: true,
      score: 100,
      source: {
        type: 'bundle',
        bundle: expect.stringContaining('production-bundle.json')
      },
      evidence: expect.objectContaining({
        ready: true,
        budget: expect.objectContaining({
          profile: '2.5d-editor-lite',
          fileCount: 3,
          overBudget: false
        })
      })
    });
    expect(report.workflow).toEqual(['plan', 'apply', 'save', 'export', 'readiness']);
    expect(report.evidence.stages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'plan', status: 'pass' }),
      expect.objectContaining({ id: 'readiness', status: 'pass', evidence: 100 })
    ]));
  });
});
