import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildPerfGifConfig,
  createBenchmarkServer,
  createStressLoopSource,
  encodeGif
} from '../scripts/generate-perf-gif.js';

describe('generate performance GIF script', () => {
  it('defaults to the benchmark showroom and branding GIF output', () => {
    const config = buildPerfGifConfig([]);

    expect(config.benchmarkPath.endsWith(path.join('tests', 'benchmark', 'benchmark.html'))).toBe(true);
    expect(config.outputPath.endsWith(path.join('assets', 'branding', 'perf-demo.gif'))).toBe(true);
    expect(config.durationMs).toBe(5000);
    expect(config.spriteCount).toBe(1000);
  });

  it('injects a 1000 sprite stress loop before frames are captured', () => {
    const source = createStressLoopSource({ spriteCount: 1000, targetFps: 144 });

    expect(source).toContain('document.querySelector("#bench")');
    expect(source).toContain('spriteCount: 1000');
    expect(source).toContain('144 FPS');
    expect(source).toContain('requestAnimationFrame');
  });

  it('encodes captured RGBA frames as a GIF file', () => {
    const temp = mkdtempSync(path.join(os.tmpdir(), 'omnicore-perf-gif-'));
    const outputPath = path.join(temp, 'perf-demo.gif');
    const frames = [
      {
        width: 2,
        height: 2,
        delayMs: 80,
        rgba: new Uint8ClampedArray([
          255, 0, 0, 255, 0, 255, 0, 255,
          0, 0, 255, 255, 255, 255, 255, 255
        ])
      },
      {
        width: 2,
        height: 2,
        delayMs: 80,
        rgba: new Uint8ClampedArray([
          255, 255, 255, 255, 0, 0, 255, 255,
          0, 255, 0, 255, 255, 0, 0, 255
        ])
      }
    ];

    encodeGif(frames, outputPath);
    const bytes = readFileSync(outputPath);

    expect(bytes.subarray(0, 6).toString('ascii')).toBe('GIF89a');
    expect(bytes.at(-1)).toBe(0x3b);

    rmSync(temp, { recursive: true, force: true });
  });

  it('serves the benchmark over HTTP so module scripts are not blocked by file URL CORS', async () => {
    const server = await createBenchmarkServer(path.resolve('tests/benchmark/benchmark.html'));
    try {
      const html = await fetch(new URL('benchmark.html', server.url));
      const script = await fetch(new URL('benchmark.js', server.url));

      expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:/);
      expect(html.ok).toBe(true);
      expect(await html.text()).toContain('./benchmark.js');
      expect(script.ok).toBe(true);
      expect(script.headers.get('content-type')).toContain('javascript');
    } finally {
      await server.close();
    }
  });
});
