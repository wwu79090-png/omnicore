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
  create25DPreviewEvidenceReport,
  write25DPreviewEvidenceReport
} from '../scripts/capture-25d-preview.js';

describe('2.5D preview screenshot evidence', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('formats screenshot evidence with certification and bundle links', () => {
    const report = create25DPreviewEvidenceReport({
      generatedAt: '2026-06-20T00:00:00.000Z',
      bundlePath: 'examples/25d-editor-deploy-loop.production-bundle.json',
      screenshotPath: 'docs/release-notes/25d-preview.png',
      screenshotBytes: 4096,
      certificationPath: 'docs/release-notes/25d-production-certification.json',
      url: 'http://127.0.0.1:43210/'
    });

    expect(report).toMatchObject({
      format: 'OmniCore.25DPreviewScreenshotEvidence',
      ready: true,
      url: 'http://127.0.0.1:43210/',
      screenshot: {
        path: 'docs/release-notes/25d-preview.png',
        bytes: 4096,
        nonBlank: true
      },
      source: {
        bundle: 'examples/25d-editor-deploy-loop.production-bundle.json',
        certification: 'docs/release-notes/25d-production-certification.json'
      }
    });
  });

  it('writes dry-run evidence without launching a browser', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-25d-capture-'));
    const screenshotPath = path.join(temp, 'preview.png');
    const reportPath = path.join(temp, 'preview-evidence.json');

    const report = write25DPreviewEvidenceReport({
      generatedAt: '2026-06-20T00:00:00.000Z',
      bundlePath: 'examples/25d-editor-deploy-loop.production-bundle.json',
      screenshotPath,
      reportPath,
      screenshotBytes: 2048,
      dryRun: true
    });

    expect(report.ready).toBe(true);
    expect(existsSync(reportPath)).toBe(true);
    expect(JSON.parse(readFileSync(reportPath, 'utf8'))).toEqual(report);
  });

  it('exposes a dry-run CLI for CI path validation', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-25d-capture-cli-'));
    const reportPath = path.join(temp, 'preview-evidence.json');
    const screenshotPath = path.join(temp, 'preview.png');
    writeFileSync(screenshotPath, Buffer.alloc(2048, 1));

    const stdout = execFileSync(process.execPath, [
      'scripts/capture-25d-preview.js',
      '--dry-run',
      '--screenshot',
      screenshotPath,
      '--report',
      reportPath,
      '--generated-at',
      '2026-06-20T00:00:00.000Z'
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    expect(stdout).toContain('25D preview screenshot evidence ready');
    expect(report.ready).toBe(true);
    expect(report.screenshot.bytes).toBe(2048);
  });
});
