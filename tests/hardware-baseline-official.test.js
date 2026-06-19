import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

describe('official hardware baseline library', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('publishes 3-month real-device FPS history and README trend image', () => {
    expect(existsSync('docs/hardware-baseline/hardware-baseline.json')).toBe(true);
    expect(existsSync('docs/hardware-baseline/real-device-fps-trend.svg')).toBe(true);

    const baseline = JSON.parse(readFileSync('docs/hardware-baseline/hardware-baseline.json', 'utf8'));
    const readme = readFileSync('README.md', 'utf8');
    const trend = readFileSync('docs/hardware-baseline/real-device-fps-trend.svg', 'utf8');

    expect(baseline.command).toBe('npm run benchmark:mobile');
    expect(baseline.devices.map((device) => device.id)).toEqual(expect.arrayContaining([
      'iphone-11',
      'snapdragon-865',
      'budget-android'
    ]));
    for (const device of baseline.devices) {
      const samples = baseline.history.filter((sample) => sample.deviceId === device.id);
      expect(samples.length).toBeGreaterThanOrEqual(3);
    }
    expect(trend).toContain('OmniCore Real Device FPS Trend');
    expect(trend).toContain('iPhone 11');
    expect(readme).toContain('OmniCore 在 iPhone 11 上的长期帧率表现');
    expect(readme).toContain('docs/hardware-baseline/real-device-fps-trend.svg');
  });

  it('updates hardware baselines from mobile benchmark samples', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-hardware-baseline-'));
    const baselinePath = path.join(temp, 'hardware-baseline.json');
    const samplePath = path.join(temp, 'sample.json');
    const trendPath = path.join(temp, 'trend.svg');
    writeFileSync(baselinePath, JSON.stringify({
      command: 'npm run benchmark:mobile',
      devices: [{ id: 'iphone-11', label: 'iPhone 11' }],
      history: []
    }, null, 2));
    writeFileSync(samplePath, JSON.stringify({
      deviceId: 'iphone-11',
      label: 'iPhone 11',
      fps: 57,
      p95FrameMs: 17.8,
      memoryMb: 248,
      scenario: 'complex-scene-benchmark',
      commit: 'mobile123'
    }, null, 2));

    execFileSync(process.execPath, [
      path.resolve('scripts/update-hardware-baseline.js'),
      '--baseline',
      baselinePath,
      '--sample',
      samplePath,
      '--trend',
      trendPath
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const updated = JSON.parse(readFileSync(baselinePath, 'utf8'));
    expect(updated.latest['iphone-11']).toMatchObject({ fps: 57, commit: 'mobile123' });
    expect(readFileSync(trendPath, 'utf8')).toContain('iPhone 11');
  });
});
