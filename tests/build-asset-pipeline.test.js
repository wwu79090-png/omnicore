import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Loader from '../src/loader/Loader.js';

describe('build asset pipeline', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('auto-atlases build images and emits multi-format fallback metadata', async () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-build-assets-'));
    const assets = path.join(temp, 'assets');
    const out = path.join(temp, 'dist-assets');
    mkdirSync(path.join(assets, 'sprites'), { recursive: true });
    writeFileSync(path.join(assets, 'sprites', 'hero.png'), 'hero-png');
    writeFileSync(path.join(assets, 'sprites', 'slime.png'), 'slime-png');

    execFileSync(process.execPath, [
      'scripts/pipeline.js',
      '--assets',
      assets,
      '--out',
      out,
      '--atlas',
      'gameplay'
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const manifest = JSON.parse(readFileSync(path.join(out, 'asset-manifest.json'), 'utf8'));
    const atlas = JSON.parse(readFileSync(path.join(out, 'gameplay.atlas'), 'utf8'));

    expect(existsSync(path.join(out, 'gameplay.png'))).toBe(true);
    expect(existsSync(path.join(out, 'gameplay.webp'))).toBe(true);
    expect(manifest.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'gameplay',
        type: 'atlas',
        formats: ['png', 'webp'],
        fallbackUrls: ['gameplay.png']
      })
    ]));
    expect(Object.keys(atlas.frames)).toEqual(['hero', 'slime']);

    const calls = [];
    const loader = new Loader({
      retries: 0,
      webpSupport: true,
      fetcher: async (url) => {
        calls.push(url);
        if (url.endsWith('.webp')) return { ok: false, text: async () => '' };
        return { ok: true, text: async () => `loaded:${url}` };
      }
    });
    const bundle = await loader.loadBundle([{ key: 'atlasTexture', url: '/gameplay.png', type: 'text' }]);

    expect(calls).toEqual(['/gameplay.webp', '/gameplay.png']);
    expect(bundle.atlasTexture).toBe('loaded:/gameplay.png');
  });
});
