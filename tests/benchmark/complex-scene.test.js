import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('complex scene benchmark gate', () => {
  it('exposes an independent 1200-entity complex-scene-benchmark at 58 FPS or higher', () => {
    const output = execFileSync(process.execPath, ['scripts/benchmark.js', 'complex-scene-benchmark'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        OMNICORE_BENCHMARK_PORT: '5187'
      }
    });
    const payload = JSON.parse(output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1));

    expect(payload.task).toBe('complex-scene-benchmark');
    expect(payload.metrics['complex-scene-benchmark']).toMatchObject({
      entities: 1200,
      fps: expect.any(Number),
      drawCallsPerFrame: expect.any(Number)
    });
    expect(payload.metrics['complex-scene-benchmark'].fps).toBeGreaterThanOrEqual(58);
    expect(payload.summary.complexScene1200Fps).toBeGreaterThanOrEqual(58);
  }, 120000);
});
