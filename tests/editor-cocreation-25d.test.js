import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { EditorCoCreator25D } from '../src/index.js';

let createEditorApp;

beforeAll(async () => {
  ({ createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href));
});

describe('OmniCore 2.5D editor co-creation', () => {
  it('plans a tower behind a forest with a sword on top from Chinese natural language', () => {
    const coCreator = new EditorCoCreator25D();
    const plan = coCreator.plan({
      prompt: '在这片树林后建一个高塔，塔顶有一把剑',
      scene: {
        entities: [{ id: 'forest', type: 'forest', x: 80, y: 120, bounds: { width: 120, height: 80 } }]
      }
    });

    expect(plan).toMatchObject({
      protocol: 'omnicore-editor-25d-cocreation/v1',
      intent: {
        structure: 'tower',
        placement: { relation: 'behind', anchor: 'forest' },
        prop: { type: 'sword', relation: 'on-top' }
      }
    });
    expect(plan.assets.map((asset) => asset.kind)).toEqual(['model-task', 'model-task']);
    expect(plan.occlusion[0]).toMatchObject({ entityId: 'forest-tower', baselineY: expect.any(Number) });
    expect(plan.shadows[0]).toMatchObject({ entityId: 'forest-tower', type: 'ellipse' });
    expect(plan.eventGraph).toMatchObject({
      format: 'OmniCore.VisualEventGraph',
      nodes: [expect.objectContaining({ id: 'inspect-sword' })]
    });
  });

  it('warns instead of crashing when an anchor cannot be resolved', () => {
    const plan = new EditorCoCreator25D().plan({
      prompt: '在月亮后建塔',
      scene: { entities: [] }
    });

    expect(plan.confidence).toBeLessThan(0.5);
    expect(plan.warnings).toContain('anchor-not-found:moon');
  });

  it('exposes editor app wrapper for 2.5D co-creation plans', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          entities: [{ id: 'forest', type: 'forest', x: 80, y: 120 }]
        }
      }
    });

    const plan = app.plan25DCoCreation({ prompt: '在树林后建一个高塔，塔顶有一把剑' });

    expect(plan.protocol).toBe('omnicore-editor-25d-cocreation/v1');
    expect(app.getState().coCreation25D).toBe(plan);
    app.destroy();
  });

  it('applies, saves, and exports a lightweight 2.5D co-creation loop', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          name: 'forest-demo',
          entities: [{ id: 'forest', type: 'forest', x: 80, y: 120, bounds: { width: 120, height: 80 } }]
        },
        sceneTabs: [
          {
            path: 'scenes/forest-demo.json',
            scene: {
              name: 'forest-demo',
              entities: [{ id: 'forest', type: 'forest', x: 80, y: 120, bounds: { width: 120, height: 80 } }]
            },
            dirty: false
          }
        ],
        activeSceneTabPath: 'scenes/forest-demo.json',
        assets: [
          { path: 'assets/models/tower.glb', type: 'model' },
          { path: 'assets/models/sword.glb', type: 'model' }
        ],
        buildSettings: {
          targets: {
            web: { enabled: true, output: 'dist/web' },
            wechat: { enabled: false, output: 'dist/wechat' }
          }
        }
      }
    });

    const plan = app.plan25DCoCreation({ prompt: '在树林后建一个高塔，塔顶有一把剑' });
    const applied = app.apply25DCoCreationPlan(plan);
    const snapshot = app.saveSnapshot('forest-demo-loop');
    const bundle = app.exportLightweightDeploymentBundle({ generatedAt: '2026-06-20T00:00:00.000Z' });

    expect(applied.entity).toMatchObject({
      id: 'forest-tower',
      type: 'dimension3d-model',
      placement: expect.objectContaining({ relation: 'behind', anchor: 'forest' }),
      coCreated: true
    });
    expect(app.getState().scene.entities.map((entity) => entity.id)).toEqual(['forest', 'forest-tower']);
    expect(app.getState().sceneTabs[0]).toMatchObject({
      path: 'scenes/forest-demo.json',
      dirty: true,
      scene: expect.objectContaining({
        entities: expect.arrayContaining([expect.objectContaining({ id: 'forest-tower' })])
      })
    });
    expect(snapshot.scene.entities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'forest-tower' })
    ]));
    expect(bundle).toMatchObject({
      format: 'OmniCore.LightweightDeploymentBundle',
      manifest: {
        profile: '2.5d-editor-lite',
        targets: ['web'],
        entryScene: 'scenes/forest-demo.scene.json',
        coCreationPlans: 1
      }
    });
    expect(bundle.files).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'scenes/forest-demo.scene.json',
        data: expect.objectContaining({
          entities: expect.arrayContaining([expect.objectContaining({ id: 'forest-tower' })])
        })
      }),
      expect.objectContaining({
        path: 'manifests/deploy-lite.json',
        data: expect.objectContaining({
          scenes: ['scenes/forest-demo.scene.json'],
          assets: ['assets/models/sword.glb', 'assets/models/tower.glb']
        })
      })
    ]));
    app.destroy();
  });

  it('gates 2.5D co-creation with production readiness evidence', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          name: 'forest-demo',
          entities: [{ id: 'forest', type: 'forest', x: 80, y: 120, bounds: { width: 120, height: 80 } }]
        },
        assets: [
          { path: 'assets/models/tower.glb', type: 'model' },
          { path: 'assets/models/sword.glb', type: 'model' }
        ],
        buildSettings: {
          targets: {
            web: { enabled: true, output: 'dist/web' }
          }
        }
      }
    });

    app.plan25DCoCreation({ prompt: '在树林后建一个高塔，塔顶有一把剑' });
    expect(app.create25DProductionReadinessReport()).toMatchObject({
      format: 'OmniCore.Editor25DProductionReadiness',
      ready: false,
      blockers: [expect.objectContaining({ code: 'cocreation-not-applied' })],
      nextActions: expect.arrayContaining(['把 2.5D 共创方案应用到场景。'])
    });

    app.apply25DCoCreationPlan();
    app.saveSnapshot('forest-demo-production');
    const report = app.create25DProductionReadinessReport({ generatedAt: '2026-06-20T00:00:00.000Z' });
    const productionBundle = app.exportProductionDeploymentBundle({ generatedAt: '2026-06-20T00:00:00.000Z' });

    expect(report).toMatchObject({
      ready: true,
      score: expect.any(Number),
      blockers: [],
      evidence: expect.objectContaining({
        appliedCoCreationPlans: 1,
        saved: true,
        deploymentBundle: '2.5d-editor-lite',
        targets: ['web']
      })
    });
    expect(report.score).toBeGreaterThanOrEqual(95);
    expect(productionBundle).toMatchObject({
      format: 'OmniCore.ProductionDeploymentBundle',
      readiness: expect.objectContaining({ ready: true }),
      deployment: expect.objectContaining({
        manifest: expect.objectContaining({ profile: '2.5d-editor-lite' })
      })
    });
    expect(productionBundle.files).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'reports/25d-production-readiness.json',
        data: expect.objectContaining({ ready: true })
      })
    ]));
    app.destroy();
  });

  it('renders a visible 2.5D production workflow panel', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          name: 'forest-demo',
          entities: [{ id: 'forest', type: 'forest', x: 80, y: 120, bounds: { width: 120, height: 80 } }]
        },
        assets: [
          { path: 'assets/models/tower.glb', type: 'model' },
          { path: 'assets/models/sword.glb', type: 'model' }
        ],
        buildSettings: {
          targets: {
            web: { enabled: true, output: 'dist/web' }
          }
        }
      }
    });

    app.plan25DCoCreation({ prompt: '在树林后建一个高塔，塔顶有一把剑' });
    expect(root.querySelector('[data-25d-production-panel]')).toBeTruthy();
    expect(root.querySelector('[data-25d-stage="plan"]')?.dataset.status).toBe('complete');
    expect(root.querySelector('[data-25d-stage="apply"]')?.dataset.status).toBe('blocked');

    app.apply25DCoCreationPlan();
    app.saveSnapshot('forest-demo-production');
    app.update(app.getState());

    expect(root.querySelector('[data-25d-production-panel]')?.textContent).toContain('2.5D 生产检查');
    expect(root.querySelector('[data-25d-production-score]')?.textContent).toContain('100');
    expect(root.querySelector('[data-25d-stage="apply"]')?.dataset.status).toBe('complete');
    expect(root.querySelector('[data-25d-stage="save"]')?.dataset.status).toBe('complete');
    expect(root.querySelector('[data-25d-stage="export"]')?.dataset.status).toBe('complete');
    expect(root.querySelector('[data-25d-stage="readiness"]')?.dataset.status).toBe('complete');
    app.destroy();
  });

  it('renders Z-axis mapping depth preview lines in the 2.5D scene view', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          name: 'depth-preview-demo',
          entities: [{
            id: 'tower',
            type: 'dimension3d-model',
            x: 96,
            y: 120,
            z: 6,
            width: 48,
            height: 80,
            bounds: { width: 48, height: 80, depth: 64 }
          }]
        }
      }
    });

    const preview = app.create25DPreview({ zToYScale: 12, showDepthMappingLines: true });
    app.update(app.getState());
    const line = root.querySelector('[data-z-depth-preview-line="tower"]');

    expect(preview.guides.zDepthPreviewLines[0]).toMatchObject({
      id: 'tower',
      from: { x: 120, y: 200 },
      to: { x: 120, y: 128 },
      depthRange: { minY: 168, maxY: 232 }
    });
    expect(line).toBeTruthy();
    expect(line?.textContent).toContain('Z 6');
    expect(line?.style.height).toBe('72px');
    app.destroy();
  });

  it('exports visual evidence for 2.5D occlusion, shadows, events, and production previews', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          name: 'forest-demo',
          entities: [{ id: 'forest', type: 'forest', x: 80, y: 120, bounds: { width: 120, height: 80 } }]
        },
        assets: [
          { path: 'assets/models/tower.glb', type: 'model' },
          { path: 'assets/models/sword.glb', type: 'model' }
        ],
        buildSettings: {
          targets: {
            web: { enabled: true, output: 'dist/web' }
          }
        }
      }
    });

    app.plan25DCoCreation({ prompt: '在树林后建一个高塔，塔顶有一把剑' });
    app.apply25DCoCreationPlan();
    app.saveSnapshot('forest-demo-production');

    const visualEvidence = app.create25DVisualEvidence({ generatedAt: '2026-06-20T00:00:00.000Z' });
    const productionBundle = app.exportProductionDeploymentBundle({ generatedAt: '2026-06-20T00:00:00.000Z' });

    expect(visualEvidence).toMatchObject({
      format: 'OmniCore.Editor25DVisualEvidence',
      ready: true,
      scene: 'forest-demo',
      layers: expect.arrayContaining([
        expect.objectContaining({ type: 'entity', entityId: 'forest-tower' }),
        expect.objectContaining({ type: 'occlusion', entityId: 'forest-tower' }),
        expect.objectContaining({ type: 'shadow', entityId: 'forest-tower' }),
        expect.objectContaining({ type: 'event', entityId: 'forest-tower' })
      ]),
      preview: expect.objectContaining({
        mode: '2.5d-editor-proof',
        screenshotHint: 'forest-demo-25d-production-preview.png'
      })
    });
    expect(visualEvidence.summary).toMatchObject({
      coCreatedEntities: 1,
      occlusionLayers: 1,
      shadowLayers: 1,
      eventLayers: 1
    });
    expect(productionBundle.files).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'reports/25d-visual-evidence.json',
        data: expect.objectContaining({ ready: true })
      })
    ]));
    app.update(app.getState());
    expect(root.querySelector('[data-25d-visual-evidence]')?.textContent).toContain('视觉证据');
    expect(root.querySelector('[data-25d-visual-layer="occlusion"]')).toBeTruthy();
    expect(root.querySelector('[data-25d-visual-layer="shadow"]')).toBeTruthy();
    app.destroy();
  });

  it('tracks saved 2.5D versions, diffs them, and rolls back safely', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          name: 'forest-demo',
          entities: [{ id: 'forest', type: 'forest', x: 80, y: 120, bounds: { width: 120, height: 80 } }]
        },
        sceneTabs: [
          {
            path: 'scenes/forest-demo.json',
            scene: {
              name: 'forest-demo',
              entities: [{ id: 'forest', type: 'forest', x: 80, y: 120, bounds: { width: 120, height: 80 } }]
            },
            dirty: false
          }
        ],
        activeSceneTabPath: 'scenes/forest-demo.json'
      }
    });

    const before = app.saveSnapshot('before-cocreation');
    app.plan25DCoCreation({ prompt: '在树林后建一个高塔，塔顶有一把剑' });
    app.apply25DCoCreationPlan();
    const after = app.saveSnapshot('after-cocreation');
    const versions = app.listSaveVersions();
    const diff = app.diffSaveVersions(before.id, after.id);

    expect(versions.map((version) => version.id)).toEqual([before.id, after.id]);
    expect(diff).toMatchObject({
      from: before.id,
      to: after.id,
      scene: 'forest-demo',
      addedEntities: [expect.objectContaining({ id: 'forest-tower' })],
      removedEntities: [],
      changedEntities: []
    });

    const rollback = app.rollbackToSaveVersion(before.id);

    expect(rollback).toMatchObject({
      id: before.id,
      scene: expect.objectContaining({
        entities: [expect.objectContaining({ id: 'forest' })]
      })
    });
    expect(app.getState().scene.entities.map((entity) => entity.id)).toEqual(['forest']);
    expect(app.getState().sceneTabs[0]).toMatchObject({
      path: 'scenes/forest-demo.json',
      dirty: true,
      scene: expect.objectContaining({
        entities: [expect.objectContaining({ id: 'forest' })]
      })
    });
    app.destroy();
  });

  it('renders save version diff UI and rolls back from the production panel', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: {
          name: 'forest-demo',
          entities: [{ id: 'forest', type: 'forest', x: 80, y: 120, bounds: { width: 120, height: 80 } }]
        },
        assets: [
          { path: 'assets/models/tower.glb', type: 'model' },
          { path: 'assets/models/sword.glb', type: 'model' }
        ],
        buildSettings: {
          targets: {
            web: { enabled: true, output: 'dist/web' }
          }
        }
      }
    });

    const before = app.saveSnapshot('before-cocreation');
    app.plan25DCoCreation({ prompt: '在树林后建一个高塔，塔顶有一把剑' });
    app.apply25DCoCreationPlan();
    app.saveSnapshot('after-cocreation');
    app.update(app.getState());

    const panel = root.querySelector('[data-save-version-panel]');
    expect(panel?.textContent).toContain('保存版本');
    expect(root.querySelectorAll('[data-save-version-row]')).toHaveLength(2);
    expect(root.querySelector('[data-save-version-diff]')?.textContent).toContain('新增 forest-tower');

    root.querySelector(`[data-save-version-rollback="${before.id}"]`).click();

    expect(app.getState().scene.entities.map((entity) => entity.id)).toEqual(['forest']);
    expect(root.querySelector('[data-editor-feedback]')?.textContent).toContain('已回滚到 before-cocreation');
    app.destroy();
  });
});
