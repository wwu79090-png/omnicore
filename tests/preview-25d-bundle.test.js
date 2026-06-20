import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  create25DBundlePreviewHtml,
  create25DBundlePreviewServer
} from '../scripts/preview-25d-bundle.js';

describe('2.5D production bundle preview server', () => {
  let temp = null;

  afterEach(async () => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('renders a production bundle as a lightweight 2.5D preview page', () => {
    const bundle = createBundleFixture();
    const html = create25DBundlePreviewHtml(bundle);

    expect(html).toContain('OmniCore 2.5D Bundle Preview');
    expect(html).toContain('forest-tower');
    expect(html).toContain('2.5d-editor-lite');
    expect(html).toContain('Production Ready');
    expect(html).toContain('Visual Evidence');
    expect(html).toContain('data-entity-id="forest-tower"');
  });

  it('serves preview HTML and bundle JSON from a caller-selected bundle path', async () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-25d-preview-'));
    const bundlePath = path.join(temp, 'production-bundle.json');
    writeFileSync(bundlePath, JSON.stringify(createBundleFixture(), null, 2), 'utf8');

    const preview = await create25DBundlePreviewServer({
      bundlePath,
      host: '127.0.0.1',
      port: 0
    });

    try {
      const html = await fetch(preview.url).then((response) => response.text());
      const servedBundle = await fetch(`${preview.url}bundle.json`).then((response) => response.json());

      expect(html).toContain('forest-tower');
      expect(servedBundle.format).toBe('OmniCore.ProductionDeploymentBundle');
      expect(readFileSync(bundlePath, 'utf8')).toContain('forest-tower');
    } finally {
      await preview.close();
    }
  });
});

function createBundleFixture() {
  return {
    format: 'OmniCore.ProductionDeploymentBundle',
    generatedAt: '2026-06-20T00:00:00.000Z',
    productionReady: true,
    readiness: {
      ready: true,
      score: 100
    },
    visualEvidence: {
      ready: true,
      summary: {
        coCreatedEntities: 1,
        occlusionLayers: 1,
        shadowLayers: 1,
        eventLayers: 1
      }
    },
    deployment: {
      manifest: {
        profile: '2.5d-editor-lite',
        targets: ['web'],
        entryScene: 'scenes/forest-demo.scene.json',
        scenes: 1,
        assets: 2,
        coCreationPlans: 1
      },
      files: [
        {
          path: 'scenes/forest-demo.scene.json',
          data: {
            name: 'forest-demo',
            entities: [
              { id: 'forest', type: 'forest', x: 80, y: 120, width: 120, height: 80 },
              {
                id: 'forest-tower',
                name: 'Forest Tower',
                type: 'dimension3d-model',
                x: 96,
                y: 72,
                width: 48,
                height: 112,
                coCreated: true,
                placement: { relation: 'behind', anchor: 'forest', baselineY: 184 }
              }
            ]
          }
        },
        { path: 'manifests/deploy-lite.json', data: { profile: '2.5d-editor-lite' } },
        { path: 'plans/25d-cocreation/forest-tower.json', data: { prompt: '在树林后建一个高塔，塔顶有一把剑' } }
      ]
    }
  };
}
