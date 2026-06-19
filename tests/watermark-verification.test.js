import { describe, expect, it } from 'vitest';
import { injectWatermark, verifyWatermark } from '../scripts/watermark-build.js';

describe('OmniCore blind watermark', () => {
  it('passes official code and rejects tampered code', () => {
    const source = 'export function tick(x){ return x + 1; }';
    const marked = injectWatermark(source, { key: 'official-test' });

    expect(verifyWatermark(marked, { key: 'official-test' }).valid).toBe(true);
    expect(verifyWatermark(marked.replace('x + 1', 'x + 2'), { key: 'official-test' }).valid).toBe(false);
  });
});
