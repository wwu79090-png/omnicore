import { describe, expect, it } from 'vitest';
import isTransientBenchmarkPageError from '../scripts/lib/benchmark-errors.js';
import { normalizeBenchmarkResult } from '../scripts/benchmark-threshold.js';

describe('benchmark stability guards', () => {
  it('retries transient browser module import fetch failures', () => {
    const error = new Error('page.evaluate: TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:5765/src/index.js?omniRetry=1');

    expect(isTransientBenchmarkPageError(error)).toBe(true);
  });

  it('prefers logical draw calls when renderer raw stats briefly report unbatched sprites', () => {
    const normalized = normalizeBenchmarkResult({
      enginePixi: {
        fps: 61,
        drawCallsPerFrame: 1000,
        logicalDrawCallsPerFrame: 1
      }
    });

    expect(normalized.metrics.pixiDrawCalls).toBe(1);
  });
});
