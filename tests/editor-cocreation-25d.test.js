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
});
