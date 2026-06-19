import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

describe('engine quality CLI', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('generates a machine-readable quality report', () => {
    temp = mkdtempSync(path.join(os.tmpdir(), 'omnicore-engine-quality-'));
    const out = path.join(temp, 'quality-report.json');

    const stdout = execFileSync(process.execPath, [
      'scripts/engine-quality-gate.js',
      '--out',
      out
    ], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    expect(existsSync(out)).toBe(true);
    expect(stdout).toContain('"ok": true');

    const report = JSON.parse(readFileSync(out, 'utf8'));
    expect(report).toMatchObject({
      ok: true,
      score: 100,
      checks: [
        { name: 'determinism', ok: true },
        { name: 'invariants', ok: true },
        { name: 'budgets', ok: true }
      ]
    });
    expect(report.failures).toEqual([]);
  });

  it('registers npm run quality:engine as the public gate command', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.scripts['quality:engine']).toBe('node scripts/engine-quality-gate.js');
  });
});
