import path from 'node:path';
import { describe, expect, it } from 'vitest';
import createViteConfig, { resolveLeanCoreBuildOutDir } from '../vite.config.js';

describe('build config helpers', () => {
  it('resolves lean core output beside the active main build outDir', () => {
    const customOutDir = path.join('C:', 'tmp', 'omnicore-eval-build');

    expect(resolveLeanCoreBuildOutDir(customOutDir)).toBe(path.resolve(customOutDir));
  });

  it('excludes nested workspace node_modules from Vitest discovery', () => {
    const config = createViteConfig({ mode: 'test', command: 'serve' });

    expect(config.test.exclude).toEqual(expect.arrayContaining(['**/node_modules/**']));
  });
});
