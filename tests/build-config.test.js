import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveLeanCoreBuildOutDir } from '../vite.config.js';

describe('build config helpers', () => {
  it('resolves lean core output beside the active main build outDir', () => {
    const customOutDir = path.join('C:', 'tmp', 'omnicore-eval-build');

    expect(resolveLeanCoreBuildOutDir(customOutDir)).toBe(path.resolve(customOutDir));
  });
});
