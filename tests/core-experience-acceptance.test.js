import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CORE_EXPERIENCE_ACCEPTANCE_ITEMS, runCoreExperienceAcceptance } from '../scripts/core-experience-acceptance.js';

describe('OmniCore core experience acceptance baseline', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('reports executable pass/fail/todo status for the five core experience dimensions', async () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-core-experience-'));
    const reportPath = path.join(temp, 'acceptance.json');

    const report = await runCoreExperienceAcceptance({
      projectRoot: process.cwd(),
      outFile: reportPath,
      tempRoot: temp
    });

    expect(CORE_EXPERIENCE_ACCEPTANCE_ITEMS.map((item) => item.key)).toEqual([
      'undoRedo',
      'wechatPackageSizeGate',
      'deprecatedApiMigration',
      'depthOcclusion25d',
      'gettingStartedPath'
    ]);
    expect(report.summary.total).toBe(5);
    expect(report.items).toHaveLength(5);
    expect(report.items.map((item) => item.status)).toEqual(
      expect.arrayContaining(['pass'])
    );
    for (const item of report.items) {
      expect(['pass', 'fail', 'todo']).toContain(item.status);
      expect(item.label).toEqual(expect.any(String));
      expect(item.evidence.length).toBeGreaterThan(0);
    }
    expect(existsSync(reportPath)).toBe(true);
    expect(JSON.parse(readFileSync(reportPath, 'utf8')).summary.total).toBe(5);
  });

  it('exposes the acceptance baseline as an npm script and CLI JSON report', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-core-experience-cli-'));
    const outFile = path.join(temp, 'acceptance.json');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.scripts['acceptance:core-experience']).toBe('node scripts/core-experience-acceptance.js');

    execFileSync(process.execPath, [
      'scripts/core-experience-acceptance.js',
      '--out',
      outFile
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 120000
    });

    const report = JSON.parse(readFileSync(outFile, 'utf8'));
    expect(report.items.map((item) => item.key)).toEqual(CORE_EXPERIENCE_ACCEPTANCE_ITEMS.map((item) => item.key));
    expect(report.summary.total).toBe(5);
  });
});
