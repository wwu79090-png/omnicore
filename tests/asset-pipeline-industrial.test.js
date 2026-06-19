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
import { afterEach, describe, expect, it, vi } from 'vitest';
import Loader from '../src/loader/Loader.js';

describe('industrial asset pipeline', () => {
  let temp = null;

  afterEach(() => {
    vi.restoreAllMocks();
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('records scene.json texture dependencies during import-assets without rebuilding the directory structure', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-import-'));
    const source = path.join(temp, 'source-assets');
    const out = path.join(temp, 'assets');
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, 'hero.png'), 'png-bytes');
    writeFileSync(path.join(source, 'scene.json'), JSON.stringify({
      format: 'OmniCore.Scene.json',
      entities: [
        { id: 'hero', texture: 'hero.png' },
        { id: 'missing', texture: 'missing.png' }
      ]
    }, null, 2));

    execFileSync(process.execPath, [
      path.resolve('scripts/import-assets.js'),
      '--source',
      source,
      '--out',
      out,
      '--manifest',
      path.join(out, 'assets.manifest.json')
    ], { cwd: process.cwd(), encoding: 'utf8' });
    const manifest = JSON.parse(readFileSync(path.join(out, 'assets.manifest.json'), 'utf8'));

    expect(manifest.images[0]).toMatchObject({
      path: expect.stringContaining('assets/sprites/hero.png'),
      referencedBy: [expect.stringContaining('scene.json')]
    });
    expect(manifest.dependencies.scenes[0]).toMatchObject({
      scene: expect.stringContaining('scene.json'),
      references: expect.arrayContaining([
        expect.objectContaining({ url: 'hero.png', exists: true }),
        expect.objectContaining({ url: 'missing.png', exists: false })
      ])
    });
  });

  it('loads webp alternatives automatically when browser support is available', async () => {
    const calls = [];
    const loader = new Loader({
      retries: 0,
      webpSupport: true,
      fetcher: async (url) => {
        calls.push(url);
        return {
          ok: true,
          text: async () => `loaded:${url}`,
          blob: async () => ({ url })
        };
      }
    });

    const bundle = await loader.loadBundle([{ key: 'hero', url: '/assets/hero.png', type: 'text' }]);

    expect(calls).toEqual(['/assets/hero.webp']);
    expect(bundle.hero).toBe('loaded:/assets/hero.webp');
  });

  it('applies platform asset quality configs and emits different package expectations', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-platform-assets-'));
    const assets = path.join(temp, 'assets');
    mkdirSync(assets, { recursive: true });
    writeFileSync(path.join(assets, 'hero.png'), '1234567890');
    writeFileSync(path.join(assets, 'assets.manifest.json'), JSON.stringify({
      images: [{ type: 'image', name: 'hero', path: 'assets/hero.png', url: 'hero.png' }]
    }, null, 2));

    const webOut = path.join(temp, 'web');
    const wechatOut = path.join(temp, 'wechat');
    execFileSync(process.execPath, [
      path.resolve('scripts/build-platform-assets.js'),
      '--target',
      'web',
      '--assets',
      assets,
      '--manifest',
      path.join(assets, 'assets.manifest.json'),
      '--out',
      webOut
    ], { cwd: process.cwd(), encoding: 'utf8' });
    execFileSync(process.execPath, [
      path.resolve('scripts/build-platform-assets.js'),
      '--target',
      'wechat',
      '--assets',
      assets,
      '--manifest',
      path.join(assets, 'assets.manifest.json'),
      '--out',
      wechatOut
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const webReport = JSON.parse(readFileSync(path.join(webOut, 'asset-package-report.json'), 'utf8'));
    const wechatReport = JSON.parse(readFileSync(path.join(wechatOut, 'asset-package-report.json'), 'utf8'));

    expect(existsSync('config/platform-assets/web.json')).toBe(true);
    expect(existsSync('config/platform-assets/wechat.json')).toBe(true);
    expect(existsSync('config/platform-assets/electron.json')).toBe(true);
    expect(webReport.imageQuality).toBe(1);
    expect(wechatReport.imageQuality).toBe(0.6);
    expect(wechatReport.estimatedBytes).toBeLessThan(webReport.estimatedBytes);
  });
});
