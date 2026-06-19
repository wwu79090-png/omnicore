import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MarketplaceServer } from '../src/index.js';

describe('developer monetization marketplace platform', () => {
  it('reviews plugin submissions, emits detail pages, install commands, and paid metadata', () => {
    const market = new MarketplaceServer({ encryptionKey: 'market-test' });
    const submitted = market.submitPlugin({
      name: 'omni-particles',
      displayName: 'Omni Particles',
      version: '1.0.0',
      developerId: 'dev-particles',
      packageName: '@omnicore/omni-particles',
      main: 'src/index.js',
      author: 'Particle Studio',
      license: 'MIT',
      isPaid: true,
      priceCents: 1900,
      packageData: 'particle bundle',
      scripts: {}
    });
    const reviewed = market.reviewPlugin('omni-particles', { reviewerId: 'bot', approved: true });
    const listing = market.generateListing('omni-particles');

    expect(submitted.securityReview).toMatchObject({ ok: true });
    expect(reviewed.status).toBe('approved');
    expect(listing).toMatchObject({
      slug: 'omni-particles',
      detailPage: 'website/marketplace/omni-particles/index.html',
      installCommand: 'omni install omni-particles',
      isPaid: true
    });
  });

  it('ships marketplace pages, review workflow, and issue form fields for five-minute publishing', () => {
    const marketplace = readFileSync('website/marketplace/index.html', 'utf8');
    const detail = readFileSync('website/marketplace/omni-particles/index.html', 'utf8');
    const pluginIssue = readFileSync('.github/ISSUE_TEMPLATE/plugin_submission.yml', 'utf8');
    const workflow = readFileSync('.github/workflows/marketplace-review.yml', 'utf8');

    expect(marketplace).toContain('开发者变现平台');
    expect(marketplace).toContain('omni install omni-particles');
    expect(marketplace).toContain('isPaid: true');
    expect(marketplace).toContain('5 分钟');
    expect(detail).toContain('data-plugin-detail="omni-particles"');
    expect(detail).toContain('下载统计');
    expect(detail).toContain('评论区');
    expect(pluginIssue).toContain('plugin.json');
    expect(pluginIssue).toContain('isPaid');
    expect(pluginIssue).toContain('npm package or Git URL');
    expect(workflow).toContain('issues');
    expect(workflow).toContain('scripts/generate-marketplace-site.js');
    expect(workflow).toContain('npm run marketplace:validate');
    expect(workflow).toContain('malicious');
  });

  it('ships tutorials with ten contributor cards, comments, download stats, and certified instructor badges', () => {
    const tutorials = readFileSync('website/tutorials/index.html', 'utf8');

    expect(existsSync('website/tutorials/index.html')).toBe(true);
    expect(tutorials.match(/class="tutorial-card"/g)).toHaveLength(10);
    expect(tutorials).toContain('认证讲师');
    expect(tutorials).toContain('评论区');
    expect(tutorials).toContain('下载统计');
    expect(tutorials).toContain('贡献者列表');
  });
});
