import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

describe('real-device long-term performance baseline library', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('ships device history, trend artifact, and README market baseline section', () => {
    expect(existsSync('docs/performance/device-baselines.json')).toBe(true);
    expect(existsSync('docs/performance/device-trend.svg')).toBe(true);

    const baseline = JSON.parse(readFileSync('docs/performance/device-baselines.json', 'utf8'));
    const trend = readFileSync('docs/performance/device-trend.svg', 'utf8');
    const readme = readFileSync('README.md', 'utf8');

    expect(baseline.metrics).toEqual(expect.arrayContaining(['fps', 'p95FrameMs', 'memoryMb']));
    expect(baseline.devices.map((device) => device.id)).toEqual(expect.arrayContaining([
      'pixel-5',
      'iphone-12',
      'windows-midrange'
    ]));
    expect(baseline.history.length).toBeGreaterThanOrEqual(6);
    expect(trend).toContain('OmniCore Device FPS Trend');
    expect(trend).toContain('Pixel 5');
    expect(readme).toContain('真实设备长期性能基线');
    expect(readme).toContain('docs/performance/device-trend.svg');
  });

  it('appends benchmark samples and regenerates a trend svg without extra dependencies', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-device-baseline-'));
    const baselinePath = path.join(temp, 'device-baselines.json');
    const samplePath = path.join(temp, 'sample.json');
    const trendPath = path.join(temp, 'device-trend.svg');
    writeFileSync(baselinePath, JSON.stringify({
      metrics: ['fps', 'p95FrameMs', 'memoryMb'],
      devices: [{ id: 'pixel-5', label: 'Pixel 5', tier: 'mid' }],
      history: []
    }, null, 2));
    writeFileSync(samplePath, JSON.stringify({
      deviceId: 'pixel-5',
      label: 'Pixel 5',
      commit: 'abc123',
      fps: 58,
      p95FrameMs: 17.2,
      memoryMb: 238,
      scenario: 'complex-scene-benchmark'
    }, null, 2));

    execFileSync(process.execPath, [
      path.resolve('scripts/update-device-baseline.js'),
      '--baseline',
      baselinePath,
      '--sample',
      samplePath,
      '--trend',
      trendPath
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const updated = JSON.parse(readFileSync(baselinePath, 'utf8'));
    expect(updated.history).toEqual([expect.objectContaining({
      deviceId: 'pixel-5',
      commit: 'abc123',
      fps: 58,
      scenario: 'complex-scene-benchmark'
    })]);
    expect(updated.latest['pixel-5']).toMatchObject({ fps: 58, memoryMb: 238 });
    expect(readFileSync(trendPath, 'utf8')).toContain('Pixel 5');
  });
});
