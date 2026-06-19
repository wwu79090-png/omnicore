import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  detectOutputRisks,
  createNoWarningSummary
} from '../scripts/lib/output-gate.js';
import { createViteDevServerCommand } from '../scripts/lib/dev-server-command.js';
import { evaluateBrowserProbe } from '../scripts/lib/health-probe.js';
import { createProductionReadyReport } from '../scripts/production-ready.js';

describe('quality gates hardening', () => {
  it('classifies stdout and stderr warnings as blocking verification risks', () => {
    const risks = detectOutputRisks({
      stdout: [
        'build finished',
        '[vite] warning: legacy chunk generated'
      ].join('\n'),
      stderr: 'DeprecationWarning: Store.set is deprecated\n'
    });

    expect(risks).toEqual([
      expect.objectContaining({ level: 'warning', stream: 'stdout', keyword: 'warning' }),
      expect.objectContaining({ level: 'warning', stream: 'stderr', keyword: 'DeprecationWarning' })
    ]);
  });

  it('keeps known benign package-manager funding noise non-blocking', () => {
    expect(detectOutputRisks({
      stdout: '168 packages are looking for funding\nfound 0 vulnerabilities\n',
      stderr: ''
    })).toEqual([]);
  });

  it('marks production readiness false when verification exits zero but prints warnings', () => {
    const report = createProductionReadyReport({
      verify: true,
      verificationTimeoutMs: 10_000,
      verificationCommands: [
        {
          name: 'warning-clean-exit',
          command: process.execPath,
          args: ['-e', 'console.warn("WARNING: hidden quality issue")']
        }
      ]
    });

    expect(report.ready).toBe(false);
    expect(report.verification.ok).toBe(false);
    expect(report.verification.failed).toEqual(['warning-clean-exit']);
    expect(report.verification.results[0].outputRisks).toEqual([
      expect.objectContaining({ keyword: 'WARNING' })
    ]);
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: 'error',
        file: 'verification',
        message: 'verification output contained warning/error text: warning-clean-exit'
      })
    ]));
  });

  it('summarizes zero-warning command batches for release reports', () => {
    const summary = createNoWarningSummary([
      { name: 'lint', ok: true, outputRisks: [] },
      { name: 'test', ok: true, outputRisks: [] }
    ]);

    expect(summary).toEqual({
      ok: true,
      commands: 2,
      riskCount: 0,
      riskyCommands: []
    });
  });

  it('starts health-check preview servers through the Node executable instead of npm shell shims', () => {
    const command = createViteDevServerCommand({
      root: process.cwd(),
      host: '127.0.0.1',
      port: 5173
    });

    expect(command.command).toBe(process.execPath);
    expect(command.args[0].replace(/\\/g, '/')).toMatch(/node_modules\/vite\/bin\/vite\.js$/);
    expect(command.args).toEqual(expect.arrayContaining([
      '--host',
      '127.0.0.1',
      '--port',
      '5173',
      '--strictPort'
    ]));
    expect(command.args).not.toContain('npm');
  });

  it('classifies browser canvas fallback as a passing health probe with diagnostics', () => {
    expect(evaluateBrowserProbe({
      pageStatus: '当前后端：canvas',
      canvasCount: 1,
      fallbackBackend: 'canvas',
      consoleIssues: ['WebGL context was lost']
    })).toMatchObject({
      status: 'pass',
      fallbackBackend: 'canvas',
      consoleIssueCount: 1
    });
  });

  it('declares an explicit favicon for browser health probes to avoid default 404 noise', () => {
    const exampleHtml = readFileSync('examples/index.html', 'utf8');

    expect(exampleHtml).toContain('rel="icon"');
    expect(exampleHtml).toContain('/assets/icons/web/favicon.png');
  });

  it('lets browser health checks boot the example through a canvas backend query parameter', () => {
    const exampleHtml = readFileSync('examples/index.html', 'utf8');
    const healthCheck = readFileSync('scripts/health-check.js', 'utf8');

    expect(exampleHtml).toContain('URLSearchParams(window.location.search)');
    expect(exampleHtml).toContain("get('backend') || 'pixi'");
    expect(healthCheck).toContain('/examples/?backend=canvas');
  });
});
