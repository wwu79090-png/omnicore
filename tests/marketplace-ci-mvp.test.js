import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MarketplaceServer } from '../src/index.js';

describe('marketplace and CI MVP', () => {
  it('registers a paid plugin and returns encrypted download metadata with revenue split', () => {
    const market = new MarketplaceServer({ encryptionKey: 'test-secret' });

    market.uploadPlugin({
      name: '3d-particles',
      version: '1.0.0',
      priceCents: 1000,
      developerId: 'dev-1',
      packageData: 'plugin bundle'
    });
    const download = market.downloadPaid('3d-particles', {
      buyerId: 'studio-1',
      paid: true
    });

    expect(download.encrypted).toBe(true);
    expect(download.payload).not.toContain('plugin bundle');
    expect(download.split).toEqual({
      developerId: 'dev-1',
      developerCents: 700,
      platformCents: 300
    });
  });

  it('runs PR quality automation for tests, e2e, benchmark, and visual artifacts', () => {
    const workflow = readFileSync('.github/workflows/pr-quality.yml', 'utf8');

    expect(workflow).toContain('pull_request');
    expect(workflow).toContain('npm test');
    expect(workflow).toContain('npm run test:e2e');
    expect(workflow).toContain('npm run benchmark:ci');
    expect(workflow).toContain('actions/upload-artifact');
    expect(workflow).toContain('visual-regression-report');
  });

  it('publishes marketplace validation artifacts from plugin review automation', () => {
    const workflow = readFileSync('.github/workflows/marketplace-review.yml', 'utf8');

    expect(workflow).toContain('npm run marketplace:validate -- --out docs/release-notes/marketplace-validation-report.json');
    expect(workflow).toContain('node scripts/generate-marketplace-site.js --emit-details');
    expect(workflow).toContain('actions/upload-artifact');
    expect(workflow).toContain('marketplace-review-report');
    expect(workflow).toContain('docs/release-notes/marketplace-validation-report.json');
  });
});
