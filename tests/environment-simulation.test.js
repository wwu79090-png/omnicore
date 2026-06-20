import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildLowMemoryBenchmarkProfile,
  networkProfiles,
  summarizeNetworkProbe
} from '../scripts/lib/environment-profiles.js';

describe('multi-environment simulation profiles', () => {
  it('defines 3G, 4G and offline profiles for backend health checks', () => {
    expect(networkProfiles.map((profile) => profile.name)).toEqual(['3g', '4g', 'offline']);
    expect(networkProfiles.find((profile) => profile.name === '3g')).toMatchObject({
      offline: false,
      latencyMs: expect.any(Number),
      downlinkKbps: expect.any(Number)
    });
    expect(networkProfiles.find((profile) => profile.name === 'offline')).toMatchObject({
      offline: true,
      expectedDegradation: 'offline-fallback'
    });
  });

  it('summarizes offline network failures as expected degradation instead of silent pass', () => {
    const summary = summarizeNetworkProbe({
      profile: networkProfiles.find((item) => item.name === 'offline'),
      loaded: false,
      error: 'net::ERR_INTERNET_DISCONNECTED'
    });

    expect(summary).toMatchObject({
      profile: 'offline',
      status: 'pass',
      degraded: true,
      reason: 'offline-fallback'
    });
  });

  it('adds network simulation to npm run test:backends', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const healthCheck = readFileSync('scripts/health-check.js', 'utf8');

    expect(packageJson.scripts['test:backends']).toBe('node scripts/health-check.js --backends --network');
    expect(healthCheck).toContain('runNetworkSimulationScan');
    expect(healthCheck).toContain('networkProfiles');
  });

  it('defines a 2GB memory-limited benchmark mode', () => {
    const profile = buildLowMemoryBenchmarkProfile({ memoryGb: 2 });
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const benchmarkScript = readFileSync('scripts/benchmark.js', 'utf8');

    expect(profile).toMatchObject({
      task: 'memory-limit',
      memoryGb: 2,
      memoryMb: 2048,
      deviceClass: 'low-memory-2gb',
      maxHeapMb: expect.any(Number)
    });
    expect(packageJson.scripts['benchmark:memory']).toBe('node scripts/benchmark.js memory-limit');
    expect(benchmarkScript).toContain("task === 'memory-limit'");
  });
});
