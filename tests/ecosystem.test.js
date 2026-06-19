import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OmniCore, { Game, Store } from '../src/index.js';
import Payment from '../src/addons/Payment.js';
import Ad from '../src/addons/Ad.js';
import WechatMiniGameMonetization from '../src/addons/WechatMiniGameMonetization.js';

describe('ecosystem and developer experience additions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('creates a WeChat RPG mini project with deploy config and default assets', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'omnicore-create-'));
    const appName = 'wechat-rpg';

    execFileSync(process.execPath, [
      path.resolve('scripts/create-omnicore-app.mjs'),
      appName,
      '--platform',
      'wechat',
      '--template',
      'rpg-mini',
      '--deploy',
      'vercel'
    ], { cwd: temp });

    const root = path.join(temp, appName);

    expect(existsSync(path.join(root, 'project.config.json'))).toBe(true);
    expect(existsSync(path.join(root, 'game.json'))).toBe(true);
    expect(existsSync(path.join(root, 'wechat-adapter.js'))).toBe(true);
    expect(existsSync(path.join(root, 'vercel.json'))).toBe(true);
    expect(existsSync(path.join(root, 'assets/sprites/default/default-atlas.json'))).toBe(true);
    expect(readFileSync(path.join(root, 'src/main.js'), 'utf8')).toContain('dialogue');

    rmSync(temp, { recursive: true, force: true });
  });

  it('runs Game in headless mode without creating a canvas renderer', async () => {
    const game = await new Game({
      headless: true,
      autoStart: false,
      autoAttach: false
    }).init();

    expect(game.headless).toBe(true);
    expect(game.renderer).toBeNull();
    expect(document.querySelector('canvas')).toBeNull();
    expect(game.scene).toBeTruthy();

    game.destroy();
  });

  it('warns on Store type drift and applies emergency patches', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = new Store(
      { fragmentCount: 1, currentLevel: 2 },
      {
        debug: true,
        emergencyPatch: {
          fragmentCount: { min: 0, max: 99, fallback: 0 },
          currentLevel: (value) => (value < 1 ? 1 : value)
        }
      }
    );

    store.set('fragmentCount', 'bad');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[OmniCore] [Store] 状态类型不一致'));

    store.set('fragmentCount', 200);
    store.set('currentLevel', -5);

    expect(store.get('fragmentCount')).toBe(0);
    expect(store.get('currentLevel')).toBe(1);
  });

  it('audits missing and unused assets from code references', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'omnicore-assets-'));
    const assets = path.join(temp, 'assets');
    const src = path.join(temp, 'src');
    mkdirSync(assets, { recursive: true });
    mkdirSync(src, { recursive: true });
    writeFileSync(path.join(assets, 'used.png'), 'x');
    writeFileSync(path.join(assets, 'unused.png'), 'x');
    writeFileSync(path.join(src, 'main.js'), "const hero = 'assets/used.png'; const missing = 'assets/missing.png';");

    execFileSync(process.execPath, [
      path.resolve('scripts/audit-assets.js'),
      '--assets',
      assets,
      '--scan',
      src,
      '--out',
      path.join(temp, 'assets-audit.json')
    ], { cwd: process.cwd() });

    const report = JSON.parse(readFileSync(path.join(temp, 'assets-audit.json'), 'utf8'));

    expect(report.missing.map((item) => item.path)).toContain('assets/missing.png');
    expect(report.unused.map((item) => item.path)).toContain('assets/unused.png');

    rmSync(temp, { recursive: true, force: true });
  });

  it('exposes new developer-facing helpers on the OmniCore namespace', () => {
    expect(typeof OmniCore.LogForwarder).toBe('function');
    expect(typeof OmniCore.LiveInspector).toBe('function');
    expect(typeof OmniCore.FeedbackWidget).toBe('function');
    expect(typeof OmniCore.ApiQuickPanel).toBe('function');
  });

  it('installs lightweight Payment and Ad addon interfaces with swappable providers', async () => {
    const runtime = {
      addons: {},
      use: OmniCore.use,
      addon: OmniCore.addon,
      Payment: null,
      Ad: null
    };

    const payment = Payment.install(runtime, {
      providerName: 'fake-pay',
      provider: {
        requestPayment: vi.fn(async (order) => ({ paid: true, orderId: order.orderId }))
      }
    });
    const ad = Ad.install(runtime, {
      providerName: 'fake-ad',
      provider: {
        showRewardedVideoAd: vi.fn(async (placementId) => ({ completed: true, placementId })),
        createBannerAd: vi.fn((placementId, options) => ({ placementId, options, show: vi.fn(), hide: vi.fn() }))
      }
    });

    await expect(payment.requestPayment({ orderId: 'order-1', amount: 6 })).resolves.toEqual({
      paid: true,
      orderId: 'order-1'
    });
    await expect(ad.showRewardedVideoAd('revive-video')).resolves.toEqual({
      completed: true,
      placementId: 'revive-video'
    });
    expect(ad.createBannerAd('home-banner', { top: 0 }).placementId).toBe('home-banner');
    expect(runtime.Payment).toBe(payment);
    expect(runtime.Ad).toBe(ad);
  });

  it('wraps WeChat mini game payment and rewarded ad SDK calls behind official adapters', async () => {
    const calls = [];
    const wx = {
      requestMidasPayment(options) {
        calls.push(['pay', options.offerId]);
        options.success({ errMsg: 'requestMidasPayment:ok' });
      },
      createRewardedVideoAd(options) {
        calls.push(['rewarded', options.adUnitId]);
        return {
          show: vi.fn(async () => undefined),
          load: vi.fn(async () => undefined),
          onClose(callback) {
            callback({ isEnded: true });
          }
        };
      },
      createBannerAd(options) {
        calls.push(['banner', options.adUnitId]);
        return { show: vi.fn(), hide: vi.fn(), destroy: vi.fn() };
      }
    };
    const runtime = { addons: {} };

    WechatMiniGameMonetization.install(runtime, { wx });

    await expect(runtime.Payment.requestPayment({ offerId: 'offer-1', buyQuantity: 1 })).resolves.toMatchObject({
      paid: true,
      provider: 'wechat'
    });
    await expect(runtime.Ad.showRewardedVideoAd('reward-1')).resolves.toMatchObject({
      completed: true,
      provider: 'wechat'
    });
    runtime.Ad.createBannerAd('banner-1', { left: 0, top: 0, width: 320 });

    expect(calls).toEqual([
      ['pay', 'offer-1'],
      ['rewarded', 'reward-1'],
      ['banner', 'banner-1']
    ]);
  });
});
