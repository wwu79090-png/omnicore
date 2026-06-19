import { execFileSync } from 'node:child_process';
import {
  afterEach,
  describe,
  expect,
  it
} from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebGPURenderer } from '../src/index.js';

describe('engine quality hardening', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('runs asset watch CLI once and writes a deterministic hot-update report', () => {
    temp = mkdtempSync(path.join(os.tmpdir(), 'omnicore-quality-assets-'));
    const report = path.join(temp, 'asset-report.json');

    execFileSync(process.execPath, [
      'scripts/asset-watch-server.js',
      '--source',
      temp,
      '--once',
      '--file',
      'hero.png',
      '--out',
      report
    ], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });

    const payload = JSON.parse(readFileSync(report, 'utf8'));
    expect(payload).toMatchObject({
      type: 'assets:hot-update',
      files: ['hero.png'],
      conversions: [{ file: 'hero.png', output: 'hero.webp' }]
    });
  });

  it('runs OTA patch CLI and emits added changed and removed file sets', () => {
    temp = mkdtempSync(path.join(os.tmpdir(), 'omnicore-quality-patch-'));
    const before = path.join(temp, 'before');
    const after = path.join(temp, 'after');
    const out = path.join(temp, 'release.patch');
    mkdirSync(before, { recursive: true });
    mkdirSync(after, { recursive: true });
    writeFileSync(path.join(before, 'old.json'), '{"v":1}');
    writeFileSync(path.join(before, 'same.json'), '{"v":1}');
    writeFileSync(path.join(before, 'changed.json'), '{"v":1}');
    writeFileSync(path.join(after, 'same.json'), '{"v":1}');
    writeFileSync(path.join(after, 'new.json'), '{"v":1}');
    writeFileSync(path.join(after, 'changed.json'), '{"v":2}');

    execFileSync(process.execPath, [
      'scripts/ota-patch.js',
      '--from',
      before,
      '--to',
      after,
      '--out',
      out
    ], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });

    const patch = JSON.parse(readFileSync(out, 'utf8'));
    expect(patch.added).toEqual(['new.json']);
    expect(patch.changed).toEqual(['changed.json']);
    expect(patch.removed).toEqual(['old.json']);
    expect(existsSync(out)).toBe(true);
  });

  it('reuses WebGPU entity buffers and normalizes non-finite entity values', () => {
    const renderer = new WebGPURenderer();

    const first = renderer.mapEntityBuffer([{ x: 1, y: 2, width: 3, height: 4 }]);
    const second = renderer.mapEntityBuffer([{
      x: Number.POSITIVE_INFINITY,
      y: Number.NaN,
      width: 5,
      height: 6,
      alpha: Number.NaN
    }]);
    const expanded = renderer.mapEntityBuffer([
      { x: 1, y: 2 },
      { x: 3, y: 4 }
    ]);

    expect(second.buffer).toBe(first.buffer);
    expect(Array.from(second.float32.slice(0, 6))).toEqual([0, 0, 5, 6, 0, 1]);
    expect(expanded.bytes).toBeGreaterThan(first.bytes);
  });
});
