import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import MarketplaceServer from '../src/marketplace/MarketplaceServer.js';

describe('marketplace backend platform', () => {
  it('indexes approved plugins with media, engine versions, install jobs, and updates', () => {
    const market = new MarketplaceServer();
    market.submitPlugin({
      name: 'omni-particles',
      displayName: 'Omni Particles',
      version: '1.0.0',
      developerId: 'particle-studio',
      publisher: 'Particle Studio',
      packageName: '@omnicore/omni-particles',
      main: 'src/index.js',
      author: 'Particle Studio',
      license: 'MIT',
      engineVersion: '>=0.1.0',
      media: {
        screenshots: ['/marketplace/omni-particles/screen.png'],
        videos: ['/marketplace/omni-particles/demo.mp4']
      },
      scripts: {}
    });
    market.reviewPlugin('omni-particles', { reviewerId: 'market-bot', approved: true });
    market.publishPluginUpdate('omni-particles', { version: '1.1.0', changelog: 'Adds GPU burst emitters.' });

    expect(market.searchPlugins('particles')[0]).toMatchObject({
      name: 'omni-particles',
      publisher: 'Particle Studio',
      version: '1.1.0',
      engineVersion: '>=0.1.0',
      media: {
        screenshots: ['/marketplace/omni-particles/screen.png'],
        videos: ['/marketplace/omni-particles/demo.mp4']
      }
    });
    expect(market.createInstallJob('omni-particles')).toMatchObject({
      plugin: 'omni-particles',
      command: 'omni install omni-particles',
      addonDir: 'addons/omni-particles',
      status: 'queued'
    });
    expect(market.getAvailableUpdates([{ name: 'omni-particles', version: '1.0.0' }])).toEqual([
      expect.objectContaining({ name: 'omni-particles', currentVersion: '1.0.0', latestVersion: '1.1.0' })
    ]);
  });

  it('renders complete marketplace cards with publisher, engine support, media, and update affordances', () => {
    const html = readFileSync('website/marketplace/index.html', 'utf8');

    expect(html).toContain('data-marketplace-search');
    expect(html).toContain('发布者');
    expect(html).toContain('支持引擎版本');
    expect(html).toContain('截图预览');
    expect(html).toContain('视频预览');
    expect(html).toContain('自动更新');
  });
});
